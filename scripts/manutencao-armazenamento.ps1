<# Manutencao local. Padrao: medicao. Apply so trata caches de ambientes encerrados explicitamente.
   Compativel com Windows PowerShell 5.1 e PowerShell 7. Manter este arquivo em ASCII.
   A raiz do repositorio vem do local deste script. O diretorio de estado (catalogo e registro)
   fica fora do repositorio e vem de -StateDirectory ou de GRAZING_HUB_ARMAZENAMENTO_ESTADO. #>
[CmdletBinding()]
param(
 [ValidateSet('Monitor','Plan','Apply','Close','Open','Check')][string]$Mode='Monitor',
 [string]$EnvironmentPath,[string]$TaskReference,[string]$PreservedCommit,
 [string]$StateDirectory=$env:GRAZING_HUB_ARMAZENAMENTO_ESTADO
)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'armazenamento-seguro.psm1') -Force -DisableNameChecking
# Raiz do repositorio: pasta acima de scripts/. Executado de uma copia em .worktrees/<nome>,
# a raiz e o checkout principal que contem essa pasta.
$scriptRepo=(Split-Path -Parent $PSScriptRoot).TrimEnd('\')
$repo=if($scriptRepo -match '^(.+)\\\.worktrees\\[^\\]+$'){$matches[1]}else{$scriptRepo}
if(-not $StateDirectory){throw 'StateDirectoryRequired'}
$StateDirectory=$StateDirectory.TrimEnd('\')
foreach($inside in @($repo,$scriptRepo)){
 if($StateDirectory -eq $inside -or $StateDirectory.StartsWith($inside+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'StateDirectoryInsideRepository'}
}
$null=Get-SafePath $StateDirectory
$catalogPath=Join-Path $StateDirectory 'manutencao-lista-permitida.json'
$statePath=Join-Path $StateDirectory 'manutencao-estado.json'
function Get-ClosureTimeUtc($Value){
 # ConvertFrom-Json pode entregar DateTime. Nao converte-lo em texto regional.
 if($Value -is [DateTime]){
  if($Value.Kind -eq [DateTimeKind]::Unspecified){throw 'ClosureTimeZoneRequired'}
  return $Value.ToUniversalTime()
 }
 if($Value -is [DateTimeOffset]){return $Value.UtcDateTime}
 if($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$'){throw 'InvalidClosureTime'}
 return [DateTime]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
}
function ConvertTo-PlainHashtable($Value){
 # Substitui ConvertFrom-Json -AsHashtable, que nao existe no PowerShell 5.1.
 if($null -eq $Value){return $null}
 if($Value -is [Management.Automation.PSCustomObject]){
  $table=@{}
  foreach($property in $Value.PSObject.Properties){$table[$property.Name]=ConvertTo-PlainHashtable $property.Value}
  return $table
 }
 if($Value -is [Array]){
  $list=[Collections.Generic.List[object]]::new()
  foreach($element in $Value){$list.Add((ConvertTo-PlainHashtable $element))}
  return ,$list.ToArray()
 }
 return $Value
}
function Read-SmallJson([string]$Path,[int]$Limit){
 $p=Get-SafePath $Path -AllowMissing
 if(-not $p){return $null}
 if($p.Item.PSIsContainer -or $p.Item.Length -gt $Limit){throw 'UnsafeStateSize'}
 ConvertTo-PlainHashtable (Get-Content -LiteralPath $Path -Raw -ErrorAction Stop|ConvertFrom-Json)
}
function Save-State($Value){
 $null=Get-SafePath $StateDirectory
 $null=Get-SafePath $statePath -AllowMissing
 $json=$Value|ConvertTo-Json -Depth 8
 if([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536){throw 'StateSizeLimit'}
 Set-Content -LiteralPath $statePath -Value $json -Encoding utf8
}
$mutex=[Threading.Mutex]::new($false,'Local\GrazingHubStorageMaintenance')
if(-not $mutex.WaitOne(0)){$mutex.Dispose();[pscustomobject]@{result='deferred';reason='outra manutencao esta em execucao'}|ConvertTo-Json -Compress;exit}
try{
 $catalog=Read-SmallJson $catalogPath 131072
 if(-not $catalog -or $catalog.schemaVersion -ne 1){throw 'InvalidCatalog'}
 $state=Read-SmallJson $statePath 65536
 if(-not $state){$state=@{schemaVersion=1;closed=@();latest=$null;lastAlerts=@{free=$null;caches=$null;failures=@()};lastRun=$null}}
 if($state.schemaVersion -ne 1){throw 'InvalidState'}
 if(-not $state.ContainsKey('lastCompleteCache')){$state.lastCompleteCache=$null}
 if($state.latest -and $state.latest.cacheComplete){$state.lastCompleteCache=@{measuredAtUtc=$state.latest.measuredAtUtc;cacheBytes=$state.latest.cacheBytes}}
 $free=[long](Get-PSDrive C -ErrorAction Stop).Free
 $level=if($free -lt 10000000000){'critical'}elseif($free -lt 20000000000){'warning'}else{'normal'}
 if($Mode -eq 'Check'){
  [pscustomobject]@{freeBytes=$free;freeLevel=$level;heavyOperationAllowed=($free -ge 10000000000);floorBytes=20000000000;maintenanceLock='livre'}|ConvertTo-Json -Compress;exit
 }
 # Medir nao exige sondar memoria ou servicos. Inspecionar processos somente
 # quando houver encerramento ou possivel exclusao de um ambiente ja encerrado.
 $processCheckPerformed=($Mode -eq 'Close' -or ($Mode -in @('Plan','Apply') -and @($state.closed).Count -gt 0))
 $processes=if($processCheckPerformed){@(Get-StorageProcesses -ProjectRoot $repo)}else{@()}
 $busy=@($processes|Where-Object {($_.UnknownCwd -and $_.Name -match '^(node|git)\.exe$') -or ($_.Name -eq 'node.exe' -and $_.Command -match '(?i)(vitest[\\/]|next[\\/]dist[\\/](bin[\\/]next|cli[\\/]next-(dev|build))|(?:^|\s)tsc(?:\.js)?(?:\s|$)|webpack[\\/])')})
 $busy+=@($processes|Where-Object {$_.UnknownCwd -or $_.Name -match '(?i)^(esbuild|swc|cleanmgr|dism)\.exe$' -or ($_.Name -match '(?i)^(pwsh|powershell)\.exe$' -and $_.Command -match '(?i)Remove-Item|Clear-RecycleBin') -or ($_.Name -eq 'git.exe' -and $_.Command -match '(?i)\s(gc|clean|prune|worktree\s+remove)\s')})
 $busy=@($busy|Sort-Object Id -Unique)
 if($Mode -in @('Close','Open')){
  if(-not $EnvironmentPath -or $EnvironmentPath -notin @($catalog.environments)){throw 'EnvironmentNotAllowlisted'}
  $null=Get-SafePath $EnvironmentPath
  if($Mode -eq 'Open'){$state.closed=@($state.closed|Where-Object {$_.path -ne $EnvironmentPath});Save-State $state;[pscustomobject]@{result='opened';path=$EnvironmentPath;freeBytes=$free}|ConvertTo-Json -Compress;exit}
  if(-not $TaskReference -or $TaskReference.Length -gt 200 -or $PreservedCommit -notmatch '^[a-f0-9]{40}$'){throw 'ClosureEvidenceRequired'}
  if(-not(Test-CacheIdle -OwnerRoot $EnvironmentPath -Processes $processes)){throw 'EnvironmentActiveOrUnknown'}
  $gitArgs=@('-c','core.fsmonitor=false','-c','gc.auto=0','-c','maintenance.auto=false','--no-optional-locks','-C',$EnvironmentPath)
  $dirty=@(& git @gitArgs status --porcelain=v1 --untracked-files=all)
  if($LASTEXITCODE -ne 0 -or $dirty.Count){throw 'PendingOrUnverifiedWork'}
  $head=(& git @gitArgs rev-parse HEAD).Trim()
  if($LASTEXITCODE -ne 0){throw 'InvalidHead'}
  $remote=(& git @gitArgs config --get remote.origin.url).Trim()
  if($remote -notmatch '^https://github\.com/[\w.-]+/[\w.-]+(?:\.git)?$'){throw 'RemoteNotApproved'}
  $oldPrompt=$env:GIT_TERMINAL_PROMPT;$env:GIT_TERMINAL_PROMPT='0'
  try{$tips=@(& git @gitArgs -c http.followRedirects=false ls-remote --heads $remote);if($LASTEXITCODE -ne 0){throw 'CannotVerifyPublishedWork'}}finally{$env:GIT_TERMINAL_PROMPT=$oldPrompt}
  if(-not @($tips|Where-Object {$_ -match ('^'+$PreservedCommit+'\s')}).Count){throw 'PreservedCommitNotPublished'}
  & git @gitArgs merge-base --is-ancestor $head $PreservedCommit
  if($LASTEXITCODE -ne 0){throw 'LocalCommitsNotPreserved'}
  $state.closed=@($state.closed|Where-Object {$_.path -ne $EnvironmentPath})+@(@{path=$EnvironmentPath;head=$head;publishedCommit=$PreservedCommit;task=$TaskReference;closedAtUtc=[DateTime]::UtcNow.ToString('o')})
  if($state.closed.Count -gt 128){throw 'ClosureRegistryLimit'}
  Save-State $state
  [pscustomobject]@{result='closed';path=$EnvironmentPath;head=$head;maintenanceDeferred=($busy.Count -gt 0);note='Somente caches permitidos ficam elegiveis. A copia e seus arquivos privados permanecem.'}|ConvertTo-Json -Compress;exit
 }
 $known=0L;$complete=$true;$failures=[Collections.Generic.List[string]]::new()
 $results=[Collections.Generic.List[object]]::new();$allowed=@($catalog.caches|ForEach-Object {$_.path})
 foreach($entry in $catalog.caches){
  $path=[string]$entry.path
  $entryMeasured=$false;$cleanupAttempted=$false
  # O catalogo nao pode autorizar categorias arbitrarias, ancestrais ou areas pessoais.
  if($entry.category -notin @('next-cache','next-dev-cache','app-cache','npm-cacache')){throw 'InvalidCategory'}
  if($entry.category -eq 'next-cache' -and $path -ne ($entry.ownerRoot+'\.next\cache')){throw 'InvalidNextPath'}
  if($entry.category -eq 'next-dev-cache' -and $path -ne ($entry.ownerRoot+'\.next\dev\cache')){throw 'InvalidNextPath'}
  try{
   $inv=Get-CacheInventory $path;$known+=$inv.Bytes;$entryMeasured=$true
   $closed=@($state.closed|Where-Object {$_.path -eq $entry.ownerRoot})
   if($Mode -in @('Plan','Apply') -and $closed.Count -eq 1 -and $entry.category -in @('next-cache','next-dev-cache') -and -not $inv.Missing){
    if($busy.Count){$results.Add(@{path=$path;result='preserved';reason='build/teste ativo ou processo nao verificavel'});continue}
    $closure=$closed[0]
    $head=(& git -c core.fsmonitor=false -c gc.auto=0 --no-optional-locks -C $entry.ownerRoot rev-parse HEAD 2>$null).Trim()
    $dirty=@(& git -c core.fsmonitor=false -c gc.auto=0 --no-optional-locks -C $entry.ownerRoot status --porcelain=v1 --untracked-files=all 2>$null)
    if($LASTEXITCODE -ne 0 -or $head -ne $closure.head -or $dirty.Count){throw 'EnvironmentChangedOrReopened'}
    $closedAtUtc=Get-ClosureTimeUtc $closure.closedAtUtc
    if(@($inv.Files|Where-Object {$_.Modified -gt $closedAtUtc.Ticks}).Count){throw 'CacheChangedAfterClosure'}
    $cleanupAttempted=($Mode -eq 'Apply')
    $r=Remove-ApprovedCache -Path $path -AllowedPaths $allowed -OwnerRoot $entry.ownerRoot -ProjectRoot $repo -Apply:($Mode -eq 'Apply')
    if($r.Result -in @('removed','missing')){$known-=$inv.Bytes}
    $results.Add(@{path=$path;result=$r.Result;logicalBytes=$r.LogicalBytes})
   }
  }catch{
   $complete=$false
   if($cleanupAttempted -and $entryMeasured){$known-=$inv.Bytes}
   elseif(-not $entryMeasured -and $_.Exception.Data.Contains('KnownBytes')){$known+=[long]$_.Exception.Data['KnownBytes']}
   $code=if($_.Exception.Message -match '^[A-Za-z]+$'){$_.Exception.Message}else{'FileSystemError'}
   $failures.Add($path+'|'+$_.Exception.GetType().Name+'|'+$code)
  }
 }
 $free=[long](Get-PSDrive C -ErrorAction Stop).Free
 $level=if($free -lt 10000000000){'critical'}elseif($free -lt 20000000000){'warning'}else{'normal'}
 $alerts=[Collections.Generic.List[string]]::new()
 if($level -eq 'normal'){$state.lastAlerts.free=$null}else{
  $last=$state.lastAlerts.free
  if(-not $last -or ($level -eq 'critical' -and $last.level -ne 'critical') -or ($last.bytes-$free -ge 2000000000)){$alerts.Add('Espaco livre '+$level+': '+[Math]::Round($free/1e9,2)+' GB. Piso preventivo: 20 GB; critico: 10 GB.');$state.lastAlerts.free=@{bytes=$free;level=$level}}
 }
 if($known -gt 10000000000){
  $last=$state.lastAlerts.caches
  $comparison=if($last -and -not $complete -and $last.ContainsKey('partialBytes')){$last.partialBytes}elseif($last){$last.bytes}else{0L}
  if(-not $last -or ($complete -and -not $last.complete) -or ($known-$comparison -ge 2000000000)){
   $alerts.Add('Caches: '+[Math]::Round($known/1e9,2)+' GB logicos'+$(if($complete){' no total.'}else{' como minimo conhecido; medicao parcial.'}))
   if($complete -or -not $last -or -not $last.complete){$state.lastAlerts.caches=@{bytes=$known;complete=$complete}}else{$state.lastAlerts.caches.partialBytes=$known}
  }
 }elseif($complete){$state.lastAlerts.caches=$null}
 $newFailures=@($failures|Sort-Object -Unique)
 foreach($f in $newFailures){if($f -notin @($state.lastAlerts.failures)){$alerts.Add('Falha de manutencao/medicao: '+$f)}}
 $state.lastAlerts.failures=$newFailures
 $state.latest=@{measuredAtUtc=[DateTime]::UtcNow.ToString('o');timeZone='America/Sao_Paulo';unit='GB decimal';freeBytes=$free;freeLevel=$level;cacheBytes=$known;cacheComplete=$complete;failureCount=$newFailures.Count;processCheckPerformed=$processCheckPerformed;busyProcessCount=if($processCheckPerformed){$busy.Count}else{$null}}
 if($complete){$state.lastCompleteCache=@{measuredAtUtc=$state.latest.measuredAtUtc;cacheBytes=$known}}
 $state.lastRun=@{mode=$Mode;results=@($results.ToArray()|Select-Object -Last 100)}
 Save-State $state
 [pscustomobject]@{latest=$state.latest;alerts=@($alerts.ToArray());results=@($results.ToArray());closedEnvironments=@($state.closed).Count}|ConvertTo-Json -Depth 6 -Compress
}finally{$mutex.ReleaseMutex();$mutex.Dispose()}
