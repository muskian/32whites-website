// A bounded presentation frame. No scroll interception, timers or patient data.
const clamp = value => Math.min(1, Math.max(0, value));
const ease = value => {const p = clamp(value); return p * p * (3 - 2 * p);};
export function storyFrame(scroll, height, viewport, header = 0) {
  const span = Math.max(1, height - viewport + header);
  const progress = clamp(scroll / span);
  const arrival = ease((progress - .38) / .42);
  return {
    progress, turn: -18 + progress * 48, scale: 1 + progress * .35,
    lift: -progress * 100, copy: 1 - ease((progress - .18) / .34), photo: arrival,
    wash: [247, 223, 230].map((start, i) => Math.round(start + ([255, 255, 255][i] - start) * arrival)),
    finished: scroll > height - header,
  };
}
