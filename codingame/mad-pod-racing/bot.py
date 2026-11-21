"""Mad Pod Racing: first baseline for the Wood 3 input protocol."""

import sys


for line in sys.stdin:
    x, y, checkpoint_x, checkpoint_y = map(int, line.split())
    # Wood 3: head straight for the next checkpoint at maximum acceleration.
    print(checkpoint_x, checkpoint_y, 100, flush=True)
