# 部门 skill 仓库安装（Windows PowerShell）
# 装进 ~\.agents\skills（各家 Agent 工具都认），检测到 Claude Code 再软链 ~\.claude\skills
# 更新：git pull; .\install.ps1
$ErrorActionPreference = 'Stop'

$src  = Join-Path $PSScriptRoot 'skills'
$dest = Join-Path $HOME '.agents\skills'
$cc   = Join-Path $HOME '.claude\skills'

if (-not (Test-Path $src)) { Write-Host "✗ 找不到 $src"; exit 1 }

New-Item -ItemType Directory -Force -Path $dest | Out-Null

# 删旧目标：软链/junction 只删链接本身（Remove-Item -Recurse 会穿透删到目标内容，必须避开）
function Remove-Target([string]$path) {
    if (-not (Test-Path $path)) { return }
    $item = Get-Item $path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        [System.IO.Directory]::Delete($path, $false)
    } else {
        Remove-Item -Recurse -Force $path
    }
}

$names = Get-ChildItem $src -Directory | ForEach-Object { $_.Name }
foreach ($name in $names) {
    $t = Join-Path $dest $name
    Remove-Target $t
    Copy-Item -Recurse (Join-Path $src $name) $t
}
Write-Host "✔ $($names.Count) 个 skill → ~\.agents\skills\"

$hasCC = (Test-Path (Join-Path $HOME '.claude')) -or (Get-Command claude -ErrorAction SilentlyContinue)
if ($hasCC) {
    New-Item -ItemType Directory -Force -Path $cc | Out-Null
    foreach ($name in $names) {
        $link   = Join-Path $cc $name
        $target = Join-Path $dest $name
        Remove-Target $link
        try   { New-Item -ItemType SymbolicLink -Path $link -Target $target | Out-Null }
        catch {
            # 未开开发者模式时 SymbolicLink 需要管理员：Junction 不需要，退而求其次
            try   { New-Item -ItemType Junction -Path $link -Target $target | Out-Null }
            catch { Copy-Item -Recurse $target $link }
        }
    }
    Write-Host "✔ Claude Code 软链已建（~\.claude\skills\）"
}

Write-Host "完成。说一句「帮我生成提交信息」即可验证。"
