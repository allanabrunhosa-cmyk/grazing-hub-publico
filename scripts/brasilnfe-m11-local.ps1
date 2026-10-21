#Requires -Version 7.2
param(
  [ValidateSet('preparar', 'servir', 'status', 'iniciar')][string]$Acao = 'status',
  [string]$Node22,
  [string]$PostgresBin = 'C:/Program Files/PostgreSQL/17/bin'
)
$ErrorActionPreference = 'Stop'
if (!$IsWindows) { throw 'DPAPI e este ambiente administrativo exigem Windows e PowerShell 7.2 ou superior.' }
$raizFiscal = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$privadoFiscal = [IO.Path]::GetFullPath((Join-Path $raizFiscal '.tmp/brasilnfe-m11-admin'))
$chavesFiscal = Join-Path $privadoFiscal 'segredos.dpapi.json'
$metaFiscal = Join-Path $privadoFiscal 'ambiente.json'
$dotenvFiscal = Join-Path $privadoFiscal 'nao-carregar.env'
$sidFiscal = [Security.Principal.WindowsIdentity]::GetCurrent().User
$sistemaFiscal = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
Set-Location -LiteralPath $raizFiscal
foreach ($arquivoFiscal in @('.env', '.env.local', '.env.development', '.env.development.local')) {
  if (Test-Path -LiteralPath (Join-Path $raizFiscal $arquivoFiscal)) { throw 'Ambiente local recusado: há arquivo de variáveis na worktree. Não copiar nem carregar segredos operacionais.' }
}
if (Test-Path -LiteralPath $dotenvFiscal) { throw 'Arquivo reservado ao bloqueio de dotenv deve permanecer inexistente.' }

function Confirmar-CaminhoFiscal([string]$caminhoFiscal) {
  $absolutoFiscal = [IO.Path]::GetFullPath($caminhoFiscal)
  if ($absolutoFiscal -ne $privadoFiscal -and !$absolutoFiscal.StartsWith($privadoFiscal + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho privado fora do diretório administrativo.' }
  $itemFiscal = Get-Item -LiteralPath $absolutoFiscal -Force
  if ($itemFiscal.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Links ou junções não são permitidos nos arquivos administrativos.' }
  return $itemFiscal
}
function Proteger-CaminhoFiscal([string]$caminhoFiscal) {
  $itemFiscal = Confirmar-CaminhoFiscal $caminhoFiscal
  # Carregar somente proprietário/DACL e persistir pelas extensões .NET evita
  # que o provedor Set-Acl tente gravar SACL e exigir SeSecurityPrivilege.
  $secoesFiscal = [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access
  $aclFiscal = if ($itemFiscal.PSIsContainer) {
    [IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]$itemFiscal, $secoesFiscal)
  } else { [IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]$itemFiscal, $secoesFiscal) }
  $aclFiscal.SetAccessRuleProtection($true, $false)
  foreach ($regraFiscal in $aclFiscal.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) { $aclFiscal.RemoveAccessRuleSpecific($regraFiscal) }
  $aclFiscal.SetOwner($sidFiscal)
  foreach ($identidadeFiscal in @($sidFiscal, $sistemaFiscal)) {
    $regraFiscal = if ($itemFiscal.PSIsContainer) {
      [Security.AccessControl.FileSystemAccessRule]::new($identidadeFiscal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    } else { [Security.AccessControl.FileSystemAccessRule]::new($identidadeFiscal, 'FullControl', 'Allow') }
    $aclFiscal.AddAccessRule($regraFiscal)
  }
  if ($itemFiscal.PSIsContainer) {
    [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]$itemFiscal, $aclFiscal)
  } else { [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]$itemFiscal, $aclFiscal) }
}
function Confirmar-ProtecaoFiscal([string]$caminhoFiscal) {
  $itemFiscal = Confirmar-CaminhoFiscal $caminhoFiscal
  $secoesFiscal = [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access
  $aclFiscal = if ($itemFiscal.PSIsContainer) {
    [IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]$itemFiscal, $secoesFiscal)
  } else { [IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]$itemFiscal, $secoesFiscal) }
  $proprietarioFiscal = $aclFiscal.GetOwner([Security.Principal.SecurityIdentifier]).Value
  $regrasFiscal = $aclFiscal.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  $alheiasFiscal = @($regrasFiscal | Where-Object { $_.IdentityReference.Value -notin @($sidFiscal.Value, $sistemaFiscal.Value) -or $_.AccessControlType -ne 'Allow' })
  $controleFiscal = @($regrasFiscal | Where-Object { $_.IdentityReference.Value -eq $sidFiscal.Value -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl })
  if ($proprietarioFiscal -ne $sidFiscal.Value -or $alheiasFiscal.Count -or !$controleFiscal.Count -or ($itemFiscal.PSIsContainer -and !$aclFiscal.AreAccessRulesProtected)) { throw 'Proteção privada divergente. Execute preparar para corrigir as permissões antes de ler o ambiente.' }
}
function Abrir-SegredoFiscal([string]$valorFiscal) {
  $ponteiroFiscal = [IntPtr]::Zero
  $seguroFiscal = $null
  try {
    $seguroFiscal = ConvertTo-SecureString $valorFiscal
    $ponteiroFiscal = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguroFiscal)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiroFiscal)
  } catch { throw 'Não foi possível abrir a chave DPAPI do usuário deste ambiente.' }
  finally {
    if ($ponteiroFiscal -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiroFiscal) }
    if ($seguroFiscal) { $seguroFiscal.Dispose() }
  }
}
function Nova-ChaveFiscal { [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)) }

function Conteudo-WrapperFiscal([string]$helperFiscal, [string]$nodeFiscal) {
  $helperLiteralFiscal = "'" + $helperFiscal.Replace("'", "''") + "'"
  $nodeLiteralFiscal = "'" + $nodeFiscal.Replace("'", "''") + "'"
  return @(
    '#Requires -Version 7.2'
    '$ErrorActionPreference = ''Stop'''
    ('& ' + $helperLiteralFiscal + ' -Acao status')
    ('& ' + $helperLiteralFiscal + ' -Acao preparar -Node22 ' + $nodeLiteralFiscal)
    ('& ' + $helperLiteralFiscal + ' -Acao servir')
  ) -join [Environment]::NewLine
}

function Rodar-Fiscal([string]$executavelFiscal, [string[]]$argumentosFiscal, [hashtable]$ambienteFiscal, [string]$logFiscal, [switch]$CapturarSaida, [switch]$PermitirFalha) {
  Confirmar-ProtecaoFiscal $privadoFiscal
  $saidaArquivoFiscal = [IO.Path]::GetFullPath((Join-Path $privadoFiscal $logFiscal))
  if (!$saidaArquivoFiscal.StartsWith($privadoFiscal + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Registro fora do diretório privado.' }
  $erroArquivoFiscal = $saidaArquivoFiscal + '.erros'
  $saidaStreamFiscal = $null
  $erroStreamFiscal = $null
  $processoFiscal = $null
  $cancelamentoFiscal = [Threading.CancellationTokenSource]::new()
  try {
    foreach ($arquivoFiscal in @($saidaArquivoFiscal, $erroArquivoFiscal)) {
      if (Test-Path -LiteralPath $arquivoFiscal) { Confirmar-ProtecaoFiscal $arquivoFiscal }
    }
    # Buffer de um byte: gravação contínua, sem acumular saída do Next em memória.
    $saidaStreamFiscal = [IO.FileStream]::new($saidaArquivoFiscal, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::Read, 1, [IO.FileOptions]::Asynchronous)
    $erroStreamFiscal = [IO.FileStream]::new($erroArquivoFiscal, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::Read, 1, [IO.FileOptions]::Asynchronous)
    Confirmar-ProtecaoFiscal $saidaArquivoFiscal
    Confirmar-ProtecaoFiscal $erroArquivoFiscal
    $inicioFiscal = [Diagnostics.ProcessStartInfo]::new($executavelFiscal)
    $inicioFiscal.UseShellExecute = $false
    $inicioFiscal.CreateNoWindow = $true
    $inicioFiscal.WorkingDirectory = $raizFiscal
    $inicioFiscal.Environment.Clear()
    foreach ($nomeFiscal in @('SystemRoot','WINDIR','ComSpec','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')) {
      if (Test-Path "Env:$nomeFiscal") { $inicioFiscal.Environment[$nomeFiscal] = (Get-Item "Env:$nomeFiscal").Value }
    }
    $inicioFiscal.Environment['PATH'] = (Split-Path $Node22) + ';' + $PostgresBin + ';' + $env:SystemRoot + '/System32'
    $inicioFiscal.Environment['TEMP'] = $privadoFiscal
    $inicioFiscal.Environment['TMP'] = $privadoFiscal
    foreach ($nomeFiscal in $ambienteFiscal.Keys) { $inicioFiscal.Environment[$nomeFiscal] = $ambienteFiscal[$nomeFiscal] }
    foreach ($argumentoFiscal in $argumentosFiscal) { [void]$inicioFiscal.ArgumentList.Add($argumentoFiscal) }
    $inicioFiscal.RedirectStandardOutput = $true
    $inicioFiscal.RedirectStandardError = $true
    $processoFiscal = [Diagnostics.Process]::Start($inicioFiscal)
    $saidaFiscal = $processoFiscal.StandardOutput.BaseStream.CopyToAsync($saidaStreamFiscal, 81920, $cancelamentoFiscal.Token)
    $erroFiscal = $processoFiscal.StandardError.BaseStream.CopyToAsync($erroStreamFiscal, 81920, $cancelamentoFiscal.Token)
    $processoFiscal.WaitForExit()
    $leiturasFiscal = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($saidaFiscal, $erroFiscal))
    # pg_ctl -l redireciona o backend ao arquivo próprio. Não depender do EOF
    # de um pipe que um descendente possa ter herdado no Windows.
    if (!$leiturasFiscal.Wait(1500)) {
      $cancelamentoFiscal.Cancel()
      $processoFiscal.StandardOutput.Dispose()
      $processoFiscal.StandardError.Dispose()
      try { [void]$leiturasFiscal.Wait(1000) } catch { }
    } else { $leiturasFiscal.GetAwaiter().GetResult() }
    $codigoFiscal = $processoFiscal.ExitCode
    $saidaStreamFiscal.Dispose(); $saidaStreamFiscal = $null
    $erroStreamFiscal.Dispose(); $erroStreamFiscal = $null
    if ($codigoFiscal -ne 0 -and !$PermitirFalha) { throw "Etapa local falhou ($logFiscal). Nenhum segredo é mostrado; conferir o registro privado." }
    $textoFiscal = $null
    if ($CapturarSaida) {
      Confirmar-ProtecaoFiscal $saidaArquivoFiscal
      if ((Get-Item -LiteralPath $saidaArquivoFiscal).Length -gt 32768) { throw 'Resposta de controle local excedeu o limite.' }
      $textoFiscal = [IO.File]::ReadAllText($saidaArquivoFiscal).Trim()
    }
    return [pscustomobject]@{ CodigoSaida = $codigoFiscal; Saida = $textoFiscal }
  } finally {
    $cancelamentoFiscal.Cancel()
    if ($processoFiscal) { $processoFiscal.StandardOutput.Dispose(); $processoFiscal.StandardError.Dispose(); $processoFiscal.Dispose() }
    if ($saidaStreamFiscal) { $saidaStreamFiscal.Dispose() }
    if ($erroStreamFiscal) { $erroStreamFiscal.Dispose() }
    $cancelamentoFiscal.Dispose()
  }
}

if ($Acao -eq 'preparar') {
  if (!(Test-Path -LiteralPath $Node22)) { throw 'Informe o executável Node22 oficial isolado.' }
  [void][IO.Directory]::CreateDirectory($privadoFiscal)
  Proteger-CaminhoFiscal $privadoFiscal
  foreach ($arquivoFiscal in @($chavesFiscal, $metaFiscal, (Join-Path $privadoFiscal 'senha-initdb.tmp'))) {
    if (Test-Path -LiteralPath $arquivoFiscal) { Proteger-CaminhoFiscal $arquivoFiscal }
  }
  $versaoFiscal = Rodar-Fiscal $Node22 @('--version') @{} 'runtime.log' -CapturarSaida
  if ($versaoFiscal.Saida -notmatch '^v22\.') { throw 'Runtime deve ser Node22.' }
  if (!(Test-Path -LiteralPath $chavesFiscal)) {
    $segredosFiscal = @{}
    foreach ($nomeFiscal in @('AUTH_SECRET','PGPASSWORD','ADMIN_PASSWORD')) { $segredosFiscal[$nomeFiscal] = ConvertFrom-SecureString (ConvertTo-SecureString (Nova-ChaveFiscal) -AsPlainText -Force) }
    $segredosFiscal | ConvertTo-Json | Set-Content -LiteralPath $chavesFiscal -Encoding utf8
    Proteger-CaminhoFiscal $chavesFiscal
  }
  if (!(Test-Path -LiteralPath $metaFiscal)) {
    @{ node22 = [IO.Path]::GetFullPath($Node22); postgresBin = $PostgresBin; portaBanco = 55449; portaApp = 3451; banco = 'admin_brasilnfe_m11'; bancoTestes = 'teste_brasilnfe_m11_sintetico'; usuarioBanco = 'fiscal_m11'; emailAdmin = 'admin-m11@example.invalid' } | ConvertTo-Json | Set-Content -LiteralPath $metaFiscal -Encoding utf8
    Proteger-CaminhoFiscal $metaFiscal
  }
}
if (!(Test-Path -LiteralPath $metaFiscal) -or !(Test-Path -LiteralPath $chavesFiscal)) { throw 'Ambiente ainda não preparado.' }
foreach ($arquivoFiscal in @($privadoFiscal, $metaFiscal, $chavesFiscal)) { Confirmar-ProtecaoFiscal $arquivoFiscal }
$configFiscal = Get-Content -LiteralPath $metaFiscal -Raw | ConvertFrom-Json
$Node22 = $configFiscal.node22
$PostgresBin = $configFiscal.postgresBin
if ($configFiscal.portaBanco -ne 55449 -or $configFiscal.portaApp -ne 3451 -or $configFiscal.banco -ne 'admin_brasilnfe_m11' -or $configFiscal.bancoTestes -ne 'teste_brasilnfe_m11_sintetico' -or $configFiscal.usuarioBanco -ne 'fiscal_m11' -or $configFiscal.emailAdmin -ne 'admin-m11@example.invalid') { throw 'Destino administrativo local divergente; operação bloqueada.' }
if ($Acao -eq 'status') {
  Write-Output 'URL administrativa: http://127.0.0.1:3451/configuracoes/integracoes/brasilnfe'
  Write-Output 'Banco: loopback55449/admin_brasilnfe_m11; testes em banco separado; sem credenciais fiscais no bootstrap.'
  return
}
if ($Acao -eq 'iniciar') {
  # Porta ocupada não identifica quem a usa; não parar nem adotar outro processo.
  $ocupacaoFiscal = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3451 })
  if ($ocupacaoFiscal.Count) { throw 'Porta 3451 já ocupada. Nenhum servidor foi identificado ou interrompido.' }
  $wrapperFiscal = Join-Path $privadoFiscal 'iniciar-persistente.ps1'
  $registroProcessoFiscal = Join-Path $privadoFiscal 'processo-local.json'
  foreach ($arquivoFiscal in @($wrapperFiscal, $registroProcessoFiscal)) {
    if (Test-Path -LiteralPath $arquivoFiscal) { Confirmar-ProtecaoFiscal $arquivoFiscal }
  }
  $helperFiscal = Join-Path $raizFiscal 'scripts/brasilnfe-m11-local.ps1'
  [IO.File]::WriteAllText($wrapperFiscal, (Conteudo-WrapperFiscal $helperFiscal $Node22) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  Proteger-CaminhoFiscal $wrapperFiscal
  Confirmar-ProtecaoFiscal $wrapperFiscal
  $pwshFiscal = Join-Path $PSHOME 'pwsh.exe'
  if (!(Test-Path -LiteralPath $pwshFiscal -PathType Leaf)) { throw 'PowerShell atual não encontrado para o lançamento local.' }
  $ambienteInicialFiscal = [Collections.Generic.List[string]]::new()
  foreach ($nomeFiscal in @('SystemRoot','WINDIR','ComSpec','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')) {
    if (Test-Path "Env:$nomeFiscal") { $ambienteInicialFiscal.Add($nomeFiscal + '=' + (Get-Item "Env:$nomeFiscal").Value) }
  }
  $ambienteInicialFiscal.Add('PATH=' + $PSHOME + ';' + $env:SystemRoot + '/System32')
  $ambienteInicialFiscal.Add('TEMP=' + $privadoFiscal)
  $ambienteInicialFiscal.Add('TMP=' + $privadoFiscal)
  # WMI local: oculto, Unicode e independente do job do lançador/provedor.
  # Não instala serviço, tarefa, recorrência ou inicialização automática.
  $inicioIndependenteFiscal = New-CimInstance -Namespace root/cimv2 -ClassName Win32_ProcessStartup -ClientOnly -Property @{
    ShowWindow = [uint16]0
    CreateFlags = [uint32]0x09000400
    EnvironmentVariables = $ambienteInicialFiscal.ToArray()
  }
  $comandoIndependenteFiscal = '"' + $pwshFiscal + '" -NoLogo -NoProfile -NonInteractive -File "' + $wrapperFiscal + '"'
  $criacaoFiscal = Invoke-CimMethod -Namespace root/cimv2 -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $comandoIndependenteFiscal
    CurrentDirectory = $raizFiscal
    ProcessStartupInformation = $inicioIndependenteFiscal
  }
  if ($criacaoFiscal.ReturnValue -ne 0 -or !$criacaoFiscal.ProcessId) { throw 'Lançamento local recusado pelo Windows. Nenhuma alternativa automática será tentada.' }
  $processoIndependenteFiscal = Get-CimInstance -Namespace root/cimv2 -ClassName Win32_Process -Filter ('ProcessId = ' + [uint32]$criacaoFiscal.ProcessId) -ErrorAction Stop
  if (!$processoIndependenteFiscal) { throw 'Processo local terminou antes da conferência. Verifique os registros privados do ambiente.' }
  $proprietarioProcessoFiscal = Invoke-CimMethod -InputObject $processoIndependenteFiscal -MethodName GetOwnerSid -ErrorAction Stop
  if ($proprietarioProcessoFiscal.ReturnValue -ne 0 -or $proprietarioProcessoFiscal.Sid -ne $sidFiscal.Value) { throw 'Identidade do processo local divergente do usuário DPAPI. Nenhuma URL de funcionamento será confirmada.' }
  $urlInicialFiscal = 'http://127.0.0.1:3451/configuracoes/integracoes/brasilnfe'
  @{ pid = [uint32]$criacaoFiscal.ProcessId; url = $urlInicialFiscal; iniciadoEm = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $registroProcessoFiscal -Encoding utf8
  Proteger-CaminhoFiscal $registroProcessoFiscal
  Confirmar-ProtecaoFiscal $registroProcessoFiscal
  Write-Output ('Lançador local iniciado. Aguarde a inicialização e confira o acesso: ' + $urlInicialFiscal)
  return
}
$segredosFiscal = Get-Content -LiteralPath $chavesFiscal -Raw | ConvertFrom-Json
$senhaBancoFiscal = Abrir-SegredoFiscal $segredosFiscal.PGPASSWORD
$urlBancoFiscal = 'postgresql://fiscal_m11:' + [uri]::EscapeDataString($senhaBancoFiscal) + '@127.0.0.1:55449/admin_brasilnfe_m11'
$envFiscal = @{ DATABASE_URL = $urlBancoFiscal; AUTH_SECRET = (Abrir-SegredoFiscal $segredosFiscal.AUTH_SECRET); NEXT_TELEMETRY_DISABLED = '1'; DOTENV_CONFIG_PATH = $dotenvFiscal }
$clusterFiscal = Join-Path $privadoFiscal 'postgres'
if ($Acao -eq 'preparar') {
  if (!(Test-Path -LiteralPath (Join-Path $clusterFiscal 'PG_VERSION'))) {
    $senhaArquivoFiscal = Join-Path $privadoFiscal 'senha-initdb.tmp'
    try {
      [IO.File]::WriteAllText($senhaArquivoFiscal, $senhaBancoFiscal)
      Proteger-CaminhoFiscal $senhaArquivoFiscal
      [void](Rodar-Fiscal (Join-Path $PostgresBin 'initdb.exe') @('-D',$clusterFiscal,'-U','fiscal_m11','-A','scram-sha-256','--pwfile',$senhaArquivoFiscal,'--encoding=UTF8','--locale=C') @{} 'initdb.log')
    } finally { if (Test-Path -LiteralPath $senhaArquivoFiscal) { Confirmar-CaminhoFiscal $senhaArquivoFiscal | Out-Null; Remove-Item -LiteralPath $senhaArquivoFiscal } }
  }
  $statusPgFiscal = Rodar-Fiscal (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',$clusterFiscal,'status') @{} 'postgres-status.log' -PermitirFalha
  if ($statusPgFiscal.CodigoSaida -eq 3) {
    $registroPgFiscal = Join-Path $privadoFiscal 'postgres.log'
    if (!(Test-Path -LiteralPath $registroPgFiscal)) { [IO.File]::WriteAllText($registroPgFiscal, '') }
    Confirmar-ProtecaoFiscal $registroPgFiscal
    [void](Rodar-Fiscal (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',$clusterFiscal,'-l',$registroPgFiscal,'-o','-h 127.0.0.1 -p 55449','-t','60','-w','start') @{} 'postgres-inicio.log')
  } elseif ($statusPgFiscal.CodigoSaida -ne 0) { throw 'Não foi possível conferir o cluster administrativo exclusivo.' }
  $envPgFiscal = @{ PGPASSWORD = $senhaBancoFiscal }
  foreach ($bancoFiscal in @('admin_brasilnfe_m11','teste_brasilnfe_m11_sintetico')) {
    $existeFiscal = Rodar-Fiscal (Join-Path $PostgresBin 'psql.exe') @('-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55449','-U','fiscal_m11','-d','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='$bancoFiscal'") $envPgFiscal 'banco-existe.log' -CapturarSaida
    if ($existeFiscal.Saida -eq '') { [void](Rodar-Fiscal (Join-Path $PostgresBin 'createdb.exe') @('-h','127.0.0.1','-p','55449','-U','fiscal_m11',$bancoFiscal) $envPgFiscal 'createdb.log') }
    elseif ($existeFiscal.Saida -ne '1') { throw 'Resultado inesperado ao conferir o banco exclusivo.' }
  }
  [void](Rodar-Fiscal $Node22 @('node_modules/prisma/build/index.js','migrate','deploy','--config','prisma7.config.ts') $envFiscal 'migration-admin.log')
  $consultaAdminFiscal = 'SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM "Usuario" WHERE email = ''admin-m11@example.invalid'') THEN ''AUSENTE'' WHEN EXISTS (SELECT 1 FROM "Usuario" u JOIN "PerfilAcesso" p ON p.id = u."perfilAcessoId" WHERE u.email = ''admin-m11@example.invalid'' AND u.ativo = TRUE AND u."excluidoEm" IS NULL AND p.sistema = ''ADMINISTRADOR'') THEN ''OK'' ELSE ''DIVERGENTE'' END'
  $adminFiscal = Rodar-Fiscal (Join-Path $PostgresBin 'psql.exe') @('-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55449','-U','fiscal_m11','-d','admin_brasilnfe_m11','-tAc',$consultaAdminFiscal) $envPgFiscal 'admin-estado.log' -CapturarSaida
  if ($adminFiscal.Saida -eq 'AUSENTE') {
    $envFiscal.ADMIN_EMAIL = 'admin-m11@example.invalid'
    $envFiscal.ADMIN_NOME = 'Administrador local Brasil NFe'
    $envFiscal.ADMIN_PASSWORD = Abrir-SegredoFiscal $segredosFiscal.ADMIN_PASSWORD
    [void](Rodar-Fiscal $Node22 @('--conditions=react-server','--import','tsx','prisma/seed-admin.ts') $envFiscal 'admin-local.log')
  } elseif ($adminFiscal.Saida -ne 'OK') { throw 'Administrador local existente está divergente. Não alterar senha, perfil ou sessões automaticamente.' }
  Write-Output 'Banco administrativo exclusivo preparado; chave persistente protegida por DPAPI/ACL. Administrador existente preservado; bootstrap sem credenciais fiscais.'
} else {
  $envFiscal.NODE_ENV = 'development'
  [void](Rodar-Fiscal $Node22 @('node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3451') $envFiscal 'aplicacao.log')
}
