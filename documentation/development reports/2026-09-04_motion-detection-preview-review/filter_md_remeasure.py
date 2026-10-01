"""Filter the 23 September 2026 three-way capture down to the lines the
re-measurement quotes, in the same spirit as md_preview_bench.txt: hex dumps,
grid rows, the IF task and I2C plumbing, the nRF's per-message chatter, the
FatFS and image task event traffic, the NN run details and the AE register
continuation lines are dropped. Every app line is kept. NULs are stripped so
git stores the file as text.

Usage: python filter_md_remeasure.py <raw log> <out file> [from MM:SS] [to MM:SS]
"""
import re
import sys

LINE = re.compile(r'^\[(\d+):(\d+\.\d+)\]\s+(\w+)\s+\|\s?(.*)$')

DROP_HIMAX = [
    r'^[0-9a-f]{3}: ',                    # hex dump rows
    r'^([0-9a-f]{2} ){8,}',              # the motion grid bytes, quoted twice more in the dump
    r'^[.#]{16}$',                        # console grid rows
    r'^(IF|IMAGE|FatFS) Task (received event|state changed)',
    r'^(IF|IMAGE|FatFS) task sending event',
    r'^I2C transmission complete',
    r'^(Assert|Negate) inter-processor interrupt',
    r'^  (Integration time|Analog gain|Digital gain|AE Mean|AEConverged)',
    r'^DEBUG: (ledFlash|cv_run)',
    r'^sensor_type:',
    r'^(Input image|Input tensor|Model invoked|NN processing took)',
    r'^Image capture \d+/\d+ took',
    r'^NN Initialisation took',
    r'^Loaded \d+ staged',
    r'^(set_memory|HX_DSP_FLAG|jump_addr|New MemDesp|slot flash_offset| 1st BL)',
]
DROP_NRF = [
    r'^[0-9a-f]{3}: ',
    r'^<info> app: !\d+',
    r'^<info> app: NUS TX Ready',
    r'^<info> app: I2C TX complete',
    r'^<info> app: AI state machine bumped',
    r'^  (Integration time|Analog gain|Digital gain|AE Mean|AEConverged)',
    r'^\s*$',
]


def main():
    src, out = sys.argv[1], sys.argv[2]
    lo = hi = None
    if len(sys.argv) > 3:
        m, s = sys.argv[3].split(':'); lo = int(m) * 60 + float(s)
    if len(sys.argv) > 4:
        m, s = sys.argv[4].split(':'); hi = int(m) * 60 + float(s)
    drop_h = [re.compile(p) for p in DROP_HIMAX]
    drop_n = [re.compile(p) for p in DROP_NRF]
    kept = dropped = 0
    with open(src, encoding='utf-8', errors='replace') as f, open(out, 'w', encoding='utf-8', newline='\n') as o:
        for raw in f:
            raw = raw.replace('\0', '').rstrip('\n')
            if raw.startswith('#'):
                o.write(raw + '\n')
                continue
            m = LINE.match(raw)
            if not m:
                continue
            t = int(m.group(1)) * 60 + float(m.group(2))
            if lo is not None and t < lo:
                continue
            if hi is not None and t > hi:
                break
            leg, body = m.group(3), m.group(4)
            rules = drop_h if leg == 'himax' else drop_n if leg == 'nrf' else []
            if any(r.search(body) for r in rules):
                dropped += 1
                continue
            o.write(raw + '\n')
            kept += 1
    print(f'kept {kept}, dropped {dropped}')


if __name__ == '__main__':
    main()
