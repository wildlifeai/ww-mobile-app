"""Measure one motion detection test run from a three-way bench log.

Usage: python measure_md.py <log> [--from MM:SS] [--to MM:SS]

For the window it reports, per leg:
  setup   : each app TX line, the Himax reply, and the gap between commands
  frames  : for every "HM0360 motion in N blocks" line, the Himax stamp, the
            nRF "BLE out: Sent" stamp, the app RAW_RX stamp, and the lags
  captured: the lag of "Captured N images" from Himax to nRF to app
  app     : the app's RAW_RX inter-line gap distribution during the run
  cleanup : the setop writes after Captured and how long after
Stamps are the logger's read time, minutes:seconds since it started. The nRF
flushes its deferred log in bursts, so its stamps can trail the Himax; order
events by the Himax lines.
"""
import re
import sys

LINE = re.compile(r'^\[(\d+):(\d+\.\d+)\]\s+(\w+)\s+\|\s?(.*)$')


def stamp(s):
    m, sec = s.split(':')
    return int(m) * 60 + float(sec)


def fmt(t):
    return f'{int(t // 60)}:{t % 60:06.3f}'


def load(path, lo, hi):
    rows = []
    with open(path, encoding='utf-8', errors='replace') as f:
        for raw in f:
            raw = raw.replace('\0', '').rstrip('\n')
            m = LINE.match(raw)
            if not m:
                continue
            t = int(m.group(1)) * 60 + float(m.group(2))
            if lo is not None and t < lo:
                continue
            if hi is not None and t > hi:
                break
            rows.append((t, m.group(3), m.group(4)))
    return rows


def first_after(rows, t0, src, pred, limit=None):
    for t, s, body in rows:
        if t < t0 or s != src:
            continue
        if limit is not None and t > t0 + limit:
            return None
        if pred(body):
            return (t, body)
    return None


def main():
    args = sys.argv[1:]
    path = args[0]
    lo = hi = None
    if '--from' in args:
        lo = stamp(args[args.index('--from') + 1])
    if '--to' in args:
        hi = stamp(args[args.index('--to') + 1])
    rows = load(path, lo, hi)
    if not rows:
        print('no rows in window')
        return

    out = []

    # -- setup: app TX lines -------------------------------------------------
    tx = [(t, b) for t, s, b in rows if s == 'app' and b.startswith('Written ')]
    out.append('== setup: app TX lines ==')
    prev = None
    for t, b in tx:
        cmd = b.split(' to the device')[0].replace('Written ', '')
        gap = f'  +{t - prev:5.1f}s' if prev is not None else ''
        out.append(f'  [{fmt(t)}] {cmd}{gap}')
        prev = t

    # -- frames -------------------------------------------------------------
    motion_h = [(t, b) for t, s, b in rows if s == 'himax' and b.startswith('HM0360 motion in')]
    motion_n = [(t, b) for t, s, b in rows if s == 'nrf' and 'BLE out: Sent' in b and 'HM0360 motion in' in b]
    motion_a = [(t, b) for t, s, b in rows if s == 'app' and 'RAW_RX received' in b and 'HM0360 motion in' in b]
    out.append('')
    out.append(f'== frames: himax {len(motion_h)}  nrf {len(motion_n)}  app {len(motion_a)} ==')
    if motion_h:
        out.append(f'  himax span {fmt(motion_h[0][0])} .. {fmt(motion_h[-1][0])}  = {motion_h[-1][0] - motion_h[0][0]:.1f}s')
        hg = [b[0] - a[0] for a, b in zip(motion_h, motion_h[1:])]
        if hg:
            hs = sorted(hg)
            out.append(f'  himax frame gap: median {hs[len(hs) // 2]:.2f}s  min {hs[0]:.2f}  max {hs[-1]:.2f}')
    if motion_a:
        out.append(f'  app   span {fmt(motion_a[0][0])} .. {fmt(motion_a[-1][0])}  = {motion_a[-1][0] - motion_a[0][0]:.1f}s')
    n = min(len(motion_h), len(motion_a))
    if n:
        out.append('  frame  himax        nrf(+s)   app(+s)   blocks')
        for i in range(n):
            th, bh = motion_h[i]
            ta = motion_a[i][0]
            tn = motion_n[i][0] if i < len(motion_n) else None
            blocks = re.search(r'in (\d+) blocks', bh)
            out.append(f'  {i + 1:5d}  {fmt(th)}   {"" if tn is None else f"{tn - th:+6.2f}"}    {ta - th:+6.2f}    {blocks.group(1) if blocks else "?"}')

    # -- captured -----------------------------------------------------------
    cap_h = first_after(rows, rows[0][0], 'himax', lambda b: b.startswith('Captured ') and 'images' in b)
    cap_n = first_after(rows, rows[0][0], 'nrf', lambda b: 'BLE out: Sent' in b and 'Captured ' in b)
    cap_a = first_after(rows, rows[0][0], 'app', lambda b: 'RAW_RX received' in b and 'Captured ' in b)
    out.append('')
    out.append('== Captured N images ==')
    if cap_h:
        out.append(f'  himax [{fmt(cap_h[0])}] {cap_h[1][:70]}')
    if cap_n:
        out.append(f'  nrf   [{fmt(cap_n[0])}]  +{cap_n[0] - cap_h[0]:.2f}s' if cap_h else f'  nrf   [{fmt(cap_n[0])}]')
    if cap_a:
        out.append(f'  app   [{fmt(cap_a[0])}]  +{cap_a[0] - cap_h[0]:.2f}s after himax' if cap_h else f'  app   [{fmt(cap_a[0])}]')

    # -- app per-line gaps during the run ------------------------------------
    if motion_h and cap_a:
        t0 = motion_h[0][0]
        t1 = cap_a[0]
        app_rx = [t for t, s, b in rows if s == 'app' and 'RAW_RX received' in b and t0 <= t <= t1]
        gaps = sorted(b - a for a, b in zip(app_rx, app_rx[1:]))
        out.append('')
        out.append(f'== app RAW_RX during the run: {len(app_rx)} lines in {t1 - t0:.1f}s ==')
        if gaps:
            out.append(f'  gap median {gaps[len(gaps) // 2]:.3f}s  p90 {gaps[int(len(gaps) * 0.9)]:.3f}s  max {gaps[-1]:.3f}s  mean {sum(gaps) / len(gaps):.3f}s')
        kinds = {}
        for t, s, b in rows:
            if s == 'app' and 'RAW_RX received' in b and t0 <= t <= t1:
                body = b.split('RAW_RX received for ', 1)[-1].split(': ', 1)[-1]
                key = re.sub(r'[0-9a-f]{2}( [0-9a-f]{2}){8,}', '<hex row>', body)
                key = re.sub(r'\d+', 'N', key)[:40]
                kinds[key] = kinds.get(key, 0) + 1
        for k, v in sorted(kinds.items(), key=lambda x: -x[1])[:10]:
            out.append(f'  {v:4d}  {k}')

    # -- cleanup ------------------------------------------------------------
    if cap_h:
        out.append('')
        out.append('== cleanup after Captured ==')
        for t, s, b in rows:
            if s == 'app' and t > cap_h[0] and (b.startswith('Written ') or '[MotionDetectionStream]' in b):
                out.append(f'  [{fmt(t)}] +{t - cap_h[0]:5.1f}s  {b[:90]}')
        sleeps = [t for t, s, b in rows if s == 'himax' and t > cap_h[0] and 'Entering DPD' in b]
        for t in sleeps[:4]:
            out.append(f'  [{fmt(t)}] +{t - cap_h[0]:5.1f}s  himax Entering DPD')

    text = '\n'.join(out)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(text)


if __name__ == '__main__':
    main()
