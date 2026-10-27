#!/bin/sh
# 通用安装：把 skills/ 下的 skill 装进共享目录 ~/.agents/skills（各家 Agent 工具都认），
# 检测到 Claude Code 再逐个软链到 ~/.claude/skills 打通。
# 更新：git pull && ./install.sh
set -e

SRC="$(cd "$(dirname "$0")" && pwd)/skills"
DEST="$HOME/.agents/skills"
CC="$HOME/.claude/skills"

[ -d "$SRC" ] || { echo "✗ 找不到 $SRC"; exit 1; }

mkdir -p "$DEST"
count=0
for dir in "$SRC"/*/; do
    name=$(basename "$dir")
    rm -rf "$DEST/$name"
    cp -R "$dir" "$DEST/$name"
    count=$((count + 1))
done
echo "✔ $count 个 skill → ~/.agents/skills/"

if [ -d "$HOME/.claude" ] || command -v claude >/dev/null 2>&1; then
    mkdir -p "$CC"
    for dir in "$SRC"/*/; do
        name=$(basename "$dir")
        ln -sfn "$DEST/$name" "$CC/$name"
    done
    echo "✔ Claude Code 软链已建（~/.claude/skills/）"
fi

echo "完成。说一句「帮我生成提交信息」即可验证。"
