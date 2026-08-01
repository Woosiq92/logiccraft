/* 키락(마스터 템포) — 템포로 올라간 음정을 도로 내린다.
 *
 * 원리는 회전 헤드 테이프다. 링 버퍼에 계속 쓰면서, 읽는 자리를 조금씩 뒤로 흘린다.
 * 흘리는 속도가 (1 - 1/비율) 이면 재생 속도만큼의 음정 변화가 상쇄된다.
 * 읽는 자리가 한 바퀴 돌 때 소리가 끊기므로, 반 바퀴 어긋난 머리 둘을 교차로 섞는다.
 * 두 머리의 이득 합이 항상 1 이라 음량이 흔들리지 않는다.
 *
 * FFT 위상 보코더를 쓰지 않는 이유: 폰에서 두 덱을 동시에 돌려야 하고,
 * ±8% 안에서는 시간축 방식으로도 귀에 걸리는 차이가 거의 없기 때문이다.
 * 크게 당기면(±50) 특유의 일렁임이 생긴다 — 알려진 대가다.
 *
 * ★ 비율이 1 일 때가 함정이다. 머리 둘을 그대로 섞으면 반 바퀴 떨어진 두 복사본이
 *   합쳐져 빗살 간섭(comb)이 생겨 소리가 얇아진다. 그래서 흐름이 멈추면 머리 하나만 쓴다.
 *   그 전환은 20ms 로 부드럽게 — 딱 소리가 나면 안 된다.
 */
class KeylockProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.W = 2048;              // 한 바퀴 길이(샘플). 짧으면 일렁이고 길면 지연이 커진다
    this.size = 8192;           // 링 버퍼
    this.bufs = [];
    this.write = 0;
    this.offset = this.W / 2;   // 읽는 자리가 쓰는 자리보다 얼마나 뒤인가
    this.solo = 1;              // 1 = 머리 하나만 (흐름 없음), 0 = 교차 섞기
  }

  _ensure(channels) {
    while (this.bufs.length < channels) this.bufs.push(new Float32Array(this.size));
  }

  _read(buf, pos) {
    // 링 버퍼에서 소수 자리까지 읽는다 (선형 보간)
    let p = pos % this.size;
    if (p < 0) p += this.size;
    const i = Math.floor(p);
    const f = p - i;
    const a = buf[i];
    const b = buf[(i + 1) % this.size];
    return a + (b - a) * f;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;

    const ch = Math.min(input.length, output.length);
    this._ensure(ch);

    const ratio = params.ratio.length > 0 ? params.ratio[0] : 1;
    const delta = 1 - 1 / (ratio || 1);
    const still = Math.abs(delta) < 1e-4;
    const W = this.W;
    const TAU = Math.PI * 2;
    // 20ms 한 극점. 흐름이 멈추고 다시 시작할 때 이득이 튀지 않게.
    const smooth = Math.exp(-1 / (0.02 * sampleRate));

    const n = input[0].length;
    for (let s = 0; s < n; s++) {
      for (let c = 0; c < ch; c++) this.bufs[c][this.write] = input[c][s];

      this.solo = (still ? 1 : 0) * (1 - smooth) + this.solo * smooth;

      let o1 = this.offset;
      let o2 = o1 + W / 2;
      if (o2 >= W) o2 -= W;
      // 이득이 0 인 자리에서 한 바퀴가 끊기도록 (그래야 이음매가 안 들린다)
      const g1f = 0.5 - 0.5 * Math.cos(TAU * (o1 / W));
      const g2f = 0.5 - 0.5 * Math.cos(TAU * (o2 / W));
      const g1 = g1f + (1 - g1f) * this.solo;
      const g2 = g2f * (1 - this.solo);

      for (let c = 0; c < ch; c++) {
        const buf = this.bufs[c];
        output[c][s] = this._read(buf, this.write - o1) * g1 + this._read(buf, this.write - o2) * g2;
      }

      if (!still) {
        this.offset += delta;
        if (this.offset >= W) this.offset -= W;
        else if (this.offset < 0) this.offset += W;
      }
      this.write = (this.write + 1) % this.size;
    }
    // 안 쓰는 채널은 비워 둔다 (앞 블록이 남아 울리지 않게)
    for (let c = ch; c < output.length; c++) output[c].fill(0);
    return true;
  }
}

registerProcessor('firstmix-keylock', KeylockProcessor);
