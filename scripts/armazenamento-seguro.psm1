# Somente metadados. Nenhuma funcao encerra processos ou altera permissoes.
# Compativel com Windows PowerShell 5.1 e PowerShell 7. Manter este arquivo em ASCII:
# o 5.1 le arquivos sem BOM como ANSI e corromperia textos acentuados.
Set-StrictMode -Version Latest
if (-not ('StorageNative' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class StorageNative {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFileW(string p,uint a,uint s,IntPtr z,uint d,uint f,IntPtr t);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandleW(SafeFileHandle h,StringBuilder p,uint n,uint f);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h, out Info i);
 [StructLayout(LayoutKind.Sequential)] struct Info { public uint Attr,CL,CH,AL,AH,ML,MH,Vol,SH,SL,Links,IH,IL; }
 public static string Proof(string path) {
  using(var h=CreateFileW(path,0,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)) {
   if(h.IsInvalid) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
   var b=new StringBuilder(32768); uint n=GetFinalPathNameByHandleW(h,b,32768,0); Info i;
   if(n==0 || n>=32768 || !GetFileInformationByHandle(h,out i)) throw new InvalidOperationException("NativeIdentity");
   string final=b.ToString(); if(final.StartsWith(@"\\?\")) final=final.Substring(4);
   if(!String.Equals(final.TrimEnd('\\'),path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("RedirectedPath");
   if((i.Attr & 1024)!=0) throw new InvalidOperationException("ReparsePoint");
   return i.Vol+":"+i.IH+":"+i.IL;
  }
 }
 public static SafeFileHandle Guard(string path) {
  // Sonda arquivos abertos. O identificador e fechado antes da operacao literal.
  var h=CreateFileW(path,0x80000000,0,IntPtr.Zero,3,0x00200000,IntPtr.Zero);
  if(h.IsInvalid) { h.Dispose(); throw new InvalidOperationException("OpenOrLockedFile"); } return h;
 }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint a,bool i,int p);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,int n,out IntPtr r);
 [DllImport("kernel32.dll")] static extern bool IsWow64Process(IntPtr h,out bool w);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int c,IntPtr[] b,int n,out int r);
 static byte[] Read(IntPtr h,long address,int n) { var b=new byte[n]; IntPtr r; if(!ReadProcessMemory(h,new IntPtr(address),b,n,out r)||r.ToInt64()!=n) throw new InvalidOperationException("UnreadableCwd"); return b; }
 // Equivale a Path.IsPathFullyQualified, ausente no .NET Framework do PowerShell 5.1.
 static bool FullyQualified(string p) {
  if(p.Length>=3 && p[1]==':' && (p[2]=='\\'||p[2]=='/') && ((p[0]>='A'&&p[0]<='Z')||(p[0]>='a'&&p[0]<='z'))) return true;
  return p.Length>=2 && (p[0]=='\\'||p[0]=='/') && (p[1]=='\\'||p[1]=='/');
 }
 public static string Cwd(int pid) {
  IntPtr h=OpenProcess(0x410,false,pid); if(h==IntPtr.Zero) throw new InvalidOperationException("UnreadableCwd");
  try {
   bool wow; if(!IsWow64Process(h,out wow)||wow||IntPtr.Size!=8) throw new InvalidOperationException("UnsupportedCwd");
   var b=new IntPtr[6]; int r; if(NtQueryInformationProcess(h,0,b,48,out r)!=0) throw new InvalidOperationException("UnreadableCwd");
   long pp=BitConverter.ToInt64(Read(h,b[1].ToInt64()+0x20,8),0);
   var u=Read(h,pp+0x38,16); int len=BitConverter.ToUInt16(u,0); long ptr=BitConverter.ToInt64(u,8);
   if(len<6||len>32766||(len%2)!=0||ptr==0) throw new InvalidOperationException("InvalidCwd");
   string cwd=Encoding.Unicode.GetString(Read(h,ptr,len));
   if(!FullyQualified(cwd)||cwd.IndexOf('\0')>=0) throw new InvalidOperationException("InvalidCwd"); return cwd;
  } finally { CloseHandle(h); }
 }
}
'@
}

function Get-SafePath {
 param([Parameter(Mandatory)][string]$Path,[switch]$AllowMissing)
 $full=[IO.Path]::GetFullPath($Path).TrimEnd('\')
 if($full -notmatch '^C:\\' -and $full -ne 'C:'){throw 'OutsideC'}
 if($full -ne $Path.TrimEnd('\')){throw 'NonCanonicalPath'}
 $cur='C:\'; $parts=@($full.Substring(3).Split('\') | Where-Object {$_})
 foreach($part in @('')+$parts){
  if($part){$cur=Join-Path $cur $part}
  try{$item=Get-Item -LiteralPath $cur -Force -ErrorAction Stop}
  catch{if($AllowMissing -and $_.CategoryInfo.Category -eq 'ObjectNotFound'){return $null};throw}
  if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType){throw 'LinkOrReparse'}
  $identity=[StorageNative]::Proof($cur)
 }
 [pscustomobject]@{Path=$full;Item=$item;Identity=$identity}
}

function Get-CacheInventory {
 param([Parameter(Mandatory)][string]$Path,[int]$MaxSeconds=120)
 $root=Get-SafePath $Path -AllowMissing
 if($null -eq $root){return [pscustomobject]@{Path=$Path;Missing=$true;Bytes=0L;Files=@();Directories=@()}}
 if(-not $root.Item.PSIsContainer){throw 'ExpectedDirectory'}
 $clock=[Diagnostics.Stopwatch]::StartNew()
 $rootFrame=[pscustomobject]@{Path=$Path;Identity=$root.Identity;Parent=$null}
 $stack=[Collections.Generic.Stack[object]]::new();$stack.Push($rootFrame)
 $files=[Collections.Generic.List[object]]::new();$dirs=[Collections.Generic.List[object]]::new();$bytes=0L
 while($stack.Count){
  if($clock.Elapsed.TotalSeconds -gt $MaxSeconds){$e=[Exception]::new('MetadataReadTimeout');$e.Data['KnownBytes']=$bytes;throw $e}
  $frame=$stack.Pop();$dir=$frame.Path
  # Os ancestrais C:\ ate o cache foram conferidos no inicio. Revalidar a cadeia
  # interna da pilha antes de descer; nao percorrer novamente ancestrais globais
  # para cada bucket do npm. A prova nativa tambem recusa redirecionamentos.
  $chain=$frame
  while($chain){
   $item=Get-Item -LiteralPath $chain.Path -Force -ErrorAction Stop
   if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType){throw 'LinkOrReparse'}
   if([StorageNative]::Proof($chain.Path) -ne $chain.Identity){throw 'DirectoryChanged'}
   $chain=$chain.Parent
  }
  $dirs.Add([pscustomobject]@{Path=$dir;Identity=$frame.Identity})
  foreach($child in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction Stop)){
   if($clock.Elapsed.TotalSeconds -gt $MaxSeconds){$e=[Exception]::new('MetadataReadTimeout');$e.Data['KnownBytes']=$bytes;throw $e}
   $name=[IO.Path]::GetFullPath($child.FullName)
   if(-not $name.StartsWith($Path.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'EscapedCache'}
   if(($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $child.LinkType){throw 'NestedLinkOrReparse'}
   $identity=[StorageNative]::Proof($name)
   if($child.PSIsContainer){$stack.Push([pscustomobject]@{Path=$name;Identity=$identity;Parent=$frame})}else{
    $files.Add([pscustomobject]@{Path=$name;Identity=$identity;Bytes=[long]$child.Length;Modified=$child.LastWriteTimeUtc.Ticks})
    $bytes+=[long]$child.Length
   }
  }
 }
 [pscustomobject]@{Path=$Path;Missing=$false;Bytes=$bytes;Files=@($files.ToArray());Directories=@($dirs.ToArray())}
}

function Get-StorageProcesses {
 # ProjectRoot: raiz do repositorio, informada por quem chama. Sem caminho fixo da maquina.
 param([string]$ProjectRoot)
 $self=[StorageNative]::Cwd($PID)
 if(-not [IO.Path]::GetFullPath($self).TrimEnd('\').Equals([IO.Path]::GetFullPath([Environment]::CurrentDirectory).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){throw 'CwdProbeMismatch'}
 $projectPrefix=if($ProjectRoot){$ProjectRoot.TrimEnd('\')+'\'}else{$null}
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 $pgServices=@(Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%'" -ErrorAction Stop)
 foreach($p in $all){
  if($p.ProcessId -eq $PID){continue}
  $projectExecutable=[bool]($projectPrefix -and ([string]$p.ExecutablePath).StartsWith($projectPrefix,[StringComparison]::OrdinalIgnoreCase))
  if($projectExecutable -or $p.Name -match '(?i)node|postgres|claude|cowork|notion|clickup|chrome|msedge|codex|npm|pnpm|yarn|git|python|powershell|pwsh|imager|esbuild|swc|cleanmgr|dism'){
   $cwd=$null;$unknown=$false
   if($projectExecutable -or $p.Name -match '(?i)^(node(?:_repl)?|postgres|git|python|pwsh|powershell|esbuild|swc)(\.exe)?$'){
    try{$cwd=[StorageNative]::Cwd([int]$p.ProcessId)}catch{
     if(-not(Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue)){continue}
     $unknown=$true
    }
    if($unknown -and $p.Name -eq 'postgres.exe'){
     $ancestor=$p; $seen=@{}
     while($ancestor -and -not $seen.ContainsKey([int]$ancestor.ProcessId)){
      $seen[[int]$ancestor.ProcessId]=$true
      $svc=@($pgServices|Where-Object ProcessId -eq $ancestor.ProcessId)
      if($svc.Count -eq 1 -and $svc[0].PathName -match '(?i)\s-D\s+"([^"]+)"'){$cwd=$matches[1];$unknown=$false;break}
      $parentId=$ancestor.ParentProcessId
      $ancestor=$all|Where-Object ProcessId -eq $parentId|Select-Object -First 1
     }
    }
   }
   [pscustomobject]@{Id=$p.ProcessId;Name=$p.Name;Cwd=$cwd;UnknownCwd=$unknown;Command=[string]$p.CommandLine;Executable=[string]$p.ExecutablePath}
  }
 }
}

function Test-CacheIdle {
 param([string]$OwnerRoot,[string]$AppPattern,[object[]]$Processes)
 if($AppPattern -and @($Processes | Where-Object {$_.Name -match $AppPattern -or $_.Executable -match $AppPattern -or $_.Command -match $AppPattern}).Count){return $false}
 if($OwnerRoot){
  foreach($p in $Processes){
   if($p.UnknownCwd){return $false}
   $owner=$OwnerRoot.Replace('/','\').TrimEnd('\')
   $cwd=if($p.Cwd){$p.Cwd.Replace('/','\').TrimEnd('\')}else{''}
   if($cwd -and ($cwd -eq $owner -or $cwd.StartsWith($owner+'\',[StringComparison]::OrdinalIgnoreCase))){return $false}
   if($p.Command){
    $command=$p.Command.Replace('/','\')
    $pattern=[regex]::Escape($owner)+'(?=[\\"\s\x27]|$)'
    if($command -match $pattern){return $false}
   }
  }
 }
 return $true
}

function Remove-ApprovedCache {
 [CmdletBinding()]
 param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string[]]$AllowedPaths,[string]$OwnerRoot,[string]$AppPattern,[string]$ProjectRoot,[switch]$Apply)
 if($Path -notin $AllowedPaths){throw 'NotAllowlisted'}
 if($Path -notmatch '\\(cache|Cache|Code Cache|GPUCache|DawnGraphiteCache|DawnWebGPUCache|_cacache|ShaderCache)$'){throw 'InvalidCacheCategory'}
 $processes=@(Get-StorageProcesses -ProjectRoot $ProjectRoot)
 if(-not (Test-CacheIdle -OwnerRoot $OwnerRoot -AppPattern $AppPattern -Processes $processes)){throw 'ActiveOrUnknownConsumer'}
 if($OwnerRoot){
  $relative=$Path.Substring($OwnerRoot.Length+1).Replace('\','/')
  $tracked=@(& git -c core.fsmonitor=false -c gc.auto=0 -c maintenance.auto=false --no-optional-locks -C $OwnerRoot ls-files -- $relative 2>$null)
  if($LASTEXITCODE -ne 0 -or $tracked.Count){throw 'TrackedOrUnverifiedCache'}
 }
 $inv=Get-CacheInventory $Path
 if($inv.Missing){return [pscustomobject]@{Path=$Path;Result='missing';LogicalBytes=0L;Files=0}}
 if(@($inv.Files|Where-Object {$_.Path -match '(?i)(?:^|\\)(?:\.env(?:\.[^\\]+)?|[^\\]+\.(?:db|sqlite|sqlite3|bak|vhd|vhdx|pem|key|pfx|p12))$'}).Count){throw 'UnexpectedPrivateCacheFile'}
 foreach($f in $inv.Files){try{$guard=[StorageNative]::Guard($f.Path);$guard.Dispose()}catch{throw 'OpenOrLockedFile'}}
 if(-not $Apply){return [pscustomobject]@{Path=$Path;Result='ready';LogicalBytes=$inv.Bytes;Files=$inv.Files.Count}}
 # Revalidar depois da varredura; nenhuma decisao depende do piso de 20 GB.
 if(-not(Test-CacheIdle -OwnerRoot $OwnerRoot -AppPattern $AppPattern -Processes @(Get-StorageProcesses -ProjectRoot $ProjectRoot))){throw 'ConsumerStarted'}
 foreach($f in $inv.Files){
  $proof=Get-SafePath $f.Path
  if($proof.Identity -ne $f.Identity -or $proof.Item.Length -ne $f.Bytes -or $proof.Item.LastWriteTimeUtc.Ticks -ne $f.Modified){throw 'ChangedDuringMeasurement'}
 }
 $removed=0L;$count=0
 foreach($f in $inv.Files){
  $proof=Get-SafePath $f.Path
  if($proof.Identity -ne $f.Identity -or $proof.Item.Length -ne $f.Bytes -or $proof.Item.LastWriteTimeUtc.Ticks -ne $f.Modified){throw 'ChangedBeforeDelete'}
  $guard=[StorageNative]::Guard($f.Path);$guard.Dispose()
  Remove-Item -LiteralPath $f.Path -ErrorAction Stop;$removed+=$f.Bytes;$count++
 }
 foreach($dir in @($inv.Directories | Sort-Object {$_.Path.Length} -Descending)){
  $proof=Get-SafePath $dir.Path
  if($proof.Identity -ne $dir.Identity){throw 'DirectoryChanged'}
  if(@(Get-ChildItem -LiteralPath $dir.Path -Force -ErrorAction Stop).Count){throw 'DirectoryChanged'}
  Remove-Item -LiteralPath $dir.Path -ErrorAction Stop
 }
 [pscustomobject]@{Path=$Path;Result='removed';LogicalBytes=$removed;Files=$count}
}
Export-ModuleMember -Function Get-SafePath,Get-CacheInventory,Get-StorageProcesses,Test-CacheIdle,Remove-ApprovedCache
