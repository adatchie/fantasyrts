#!/usr/bin/env python3
"""
Sprite Image Normalizer
スプライト画像を128×128の正方形に正規化します。

使用方法:
  python normalize_sprites.py
  または、このファイルに画像ファイルをドラッグ&ドロップ

機能:
  - 透明な余白を自動トリミング
  - 内容を128×128の中央に配置
  - アスペクト比を維持
"""

from PIL import Image
import sys
import os
import glob

TARGET_SIZE = 128

def normalize_image(input_path, output_path=None, size=TARGET_SIZE):
    """画像を正方形に正規化して中央配置"""
    try:
        img = Image.open(input_path).convert("RGBA")

        # 透明な余白を削除してバウンディングボックス取得
        bbox = img.getbbox()

        if bbox:
            # 内容部分を抽出
            content = img.crop(bbox)

            # アスペクト比維持でsize×sizeに収まるようにリサイズ
            content.thumbnail((size, size), Image.Resampling.LANCZOS)

            # 中央配置のsize×sizeキャンバス作成
            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            x = (size - content.width) // 2
            y = (size - content.height) // 2
            canvas.paste(content, (x, y), content)

            # 出力パス決定
            if output_path is None:
                # 上書き
                output_path = input_path

            canvas.save(output_path)
            print(f"✓ {os.path.basename(input_path)} → {os.path.basename(output_path)}")
            return True
        else:
            print(f"✗ {os.path.basename(input_path)}: 空の画像です")
            return False

    except Exception as e:
        print(f"✗ {os.path.basename(input_path)}: {e}")
        return False


def process_files(files, output_dir=None):
    """複数ファイルを一括処理"""
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    processed = 0
    failed = 0

    for file_path in files:
        if not os.path.exists(file_path):
            continue

        if output_dir:
            basename = os.path.basename(file_path)
            output_path = os.path.join(output_dir, basename)
        else:
            output_path = None

        if normalize_image(file_path, output_path):
            processed += 1
        else:
            failed += 1

    print(f"\n完了: {processed}件成功, {failed}件失敗")


def main():
    if len(sys.argv) > 1:
        # ドラッグ&ドロップまたは引数で渡されたファイルを処理
        files = []
        for arg in sys.argv[1:]:
            if os.path.isfile(arg):
                files.append(arg)
            elif os.path.isdir(arg):
                # ディレクトリの場合はPNGファイルを全て取得
                files.extend(glob.glob(os.path.join(arg, "*.png")))
                files.extend(glob.glob(os.path.join(arg, "*.jpg")))
                files.extend(glob.glob(os.path.join(arg, "*.jpeg")))

        if files:
            print(f"=== Sprite Normalizer ({TARGET_SIZE}×{TARGET_SIZE}) ===")
            print(f"{len(files)}個のファイルを処理します...\n")
            process_files(files)
        else:
            print("使用方法: python normalize_sprites.py <画像ファイルまたはフォルダ>")
    else:
        # 引数なしの場合はカレントディレクトリのPNGを処理
        files = glob.glob("*.png")
        if files:
            print(f"=== Sprite Normalizer ({TARGET_SIZE}×{TARGET_SIZE}) ===")
            print(f"カレントディレクトリの{len(files)}個のPNGファイルを処理します...\n")
            process_files(files)
        else:
            print("使用方法:")
            print("  1. 画像ファイルをこのスクリプトにドラッグ&ドロップ")
            print("  2. または: python normalize_sprites.py <ファイル/フォルダ>")
            input()


if __name__ == "__main__":
    main()
