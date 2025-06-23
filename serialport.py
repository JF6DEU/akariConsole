import serial
import sys
import json
from PyDMX import *

# 初期化（ポートは環境に合わせて変更）
port = 'COM4'
ser = PyDMX(port);

def send_dmx(data):
    # 入力されたDMX配列を0〜512チャンネル分に調整
    dmx_data = list(data)
    if len(dmx_data) < 512:
        dmx_data += [0] * (512 - len(dmx_data))
    else:
        dmx_data = dmx_data[:512]  # 長すぎる場合は切る

    # Enttec Open USB DMX 用のパケット作成
    no = 0
    for dt in dmx_data:
        no += 1
        ser.set_data(no, dt)
    ser.send()

print("DMX daemon ready")

while True:
    line = sys.stdin.readline()
    if not line:
        break
    try:
        data = json.loads(line.strip())
        if isinstance(data, list):
            send_dmx(data)
        else:
            print("Expected a list of DMX values", file=sys.stderr)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
