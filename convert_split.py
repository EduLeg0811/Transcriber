#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil

def check_ffmpeg():
    if not shutil.which("ffmpeg"):
        print("\033[91mErro: 'ffmpeg' não foi encontrado no PATH do sistema.\033[0m")
        print("Por favor, instale o FFmpeg e adicione-o às variáveis de ambiente.")
        print("No Windows (PowerShell): winget install Gyan.FFmpeg")
        sys.exit(1)

def list_media_files():
    valid_exts = (".mp4", ".m4a", ".mp3", ".wav", ".webm", ".mov", ".mkv", ".avi")
    files = [f for f in os.listdir(".") if f.lower().endswith(valid_exts)]
    return sorted(files)

def run_conversion(input_path, output_pattern="part_%03d.mp3", segment_time=3000):
    print(f"\n\033[94mIniciando conversão e fatiamento de:\033[0m {input_path}")
    
    # 64kbps mono MP3 = 8KB/s. 3000 segundos (50 min) ≈ 24MB por segmento (abaixo do limite de 25MB da OpenAI)
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        "-f", "segment",
        "-segment_time", str(segment_time),
        output_pattern
    ]
    
    try:
        # Executa mostrando o progresso simplificado
        process = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
        print("Processando... Por favor, aguarde.")
        
        while True:
            line = process.stderr.readline()
            if not line and process.poll() is not None:
                break
            if "size=" in line or "time=" in line:
                print(f"\r{line.strip()}", end="")
                sys.stdout.flush()
                
        print("\n")
        if process.returncode == 0:
            print("\033[92mSucesso! Arquivo convertido e dividido com sucesso.\033[0m")
            # Lista os arquivos gerados
            generated = [f for f in os.listdir(".") if f.startswith("part_") and f.endswith(".mp3")]
            print("\nArquivos gerados:")
            for g in sorted(generated):
                size_mb = os.path.getsize(g) / 1024 / 1024
                print(f" - {g} ({size_mb:.2f} MB)")
            print("\nAgora você pode subir esses pedaços diretamente na aplicação!")
        else:
            print(f"\033[91mErro no processamento do FFmpeg (Código {process.returncode})\033[0m")
    except Exception as e:
        print(f"\033[91mOcorreu um erro ao rodar o script: {e}\033[0m")

def main():
    check_ffmpeg()
    
    # Se um arquivo foi arrastado ou passado por argumento
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        if not os.path.exists(input_file):
            print(f"\033[91mArquivo não encontrado:\033[0m {input_file}")
            sys.exit(1)
        run_conversion(input_file)
        return

    # Caso contrário, lista arquivos na pasta atual
    print("=== Conversor & Fatiador Offline Cons-IA ===")
    media_files = list_media_files()
    
    if not media_files:
        print("\nNenhum arquivo de mídia encontrado na pasta atual.")
        print("Coloque este script na mesma pasta do seu vídeo ou passe o caminho do arquivo como argumento:")
        print("  python convert_split.py caminho/do/seu/video.mp4")
        input("\nPressione Enter para sair...")
        sys.exit(0)
        
    print("\nSelecione o arquivo que deseja converter:")
    for idx, f in enumerate(media_files, 1):
        size_mb = os.path.getsize(f) / 1024 / 1024
        print(f"[{idx}] {f} ({size_mb:.2f} MB)")
        
    try:
        choice = input(f"\nDigite o número (1-{len(media_files)}) ou 'q' para sair: ")
        if choice.lower() == 'q':
            sys.exit(0)
        idx = int(choice) - 1
        if 0 <= idx < len(media_files):
            run_conversion(media_files[idx])
        else:
            print("\033[91mOpção inválida.\033[0m")
    except ValueError:
        print("\033[91mPor favor, digite um número válido.\033[0m")
    
    input("\nPressione Enter para encerrar...")

if __name__ == "__main__":
    main()
