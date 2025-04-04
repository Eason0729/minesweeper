import { assertEquals, assertExists } from "@std/assert";

export type Position = `${number}-${number}`;

interface RevealEvent {
  position: Position;
  nearbyMine?: number;
}

const deltaMap: { x: number; y: number }[] = [
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
];

class MineSlot {
  hasMine: boolean;
  nearbyMine: number = 0;
  reveal: boolean = false;
  constructor(hasMine: boolean = false) {
    this.hasMine = hasMine;
  }
}

export class MineBoard {
  private slots: Record<Position, MineSlot> = {};

  private revealCount: number = 0;
  private totalSpaceCount: number = 0;
  private randomer: (x: number, y: number) => boolean;
  public state: "playing" | "dead" | "win" = "playing";

  public width: number;
  public height: number;
  private fieldInited: boolean = false;

  constructor(
    width: number,
    height: number,
    randomer?: (x: number, y: number) => boolean,
  ) {
    this.width = width;
    this.height = height;
    this.randomer = randomer || (() => Math.random() < 0.2);
  }
  private isVaildPosition(x: number, y: number) {
    return !(x < 0 || x >= this.width || y < 0 || y >= this.height);
  }
  /**
   * return nearby mine(excluding itself)
   * @param x index
   * @param y index
   */
  private nearByMine(i: number, j: number): number {
    let count = 0;
    for (const { x, y } of deltaMap) {
      const position = `${i + x}-${j + y}` as Position;
      if (this.slots[position] && this.slots[position].hasMine) {
        count++;
      }
    }
    return count;
  }
  private initField(x: number, y: number) {
    if (this.fieldInited) return;

    this.fieldInited = true;

    const clickPosition = `${x}-${y}` as Position;

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        const position = `${i}-${j}` as Position;
        const hasMine = (position == clickPosition)
          ? false
          : this.randomer(i, j);

        this.slots[position] = new MineSlot(hasMine);

        if (!hasMine) this.totalSpaceCount++;
      }
    }

    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        const position = `${i}-${j}` as Position;
        this.slots[position].nearbyMine = this.nearByMine(i, j);
      }
    }
  }
  /**
   * get touching slot without mine or mine hint
   * @param x
   * @param y
   * @returns touching slot without mine
   */
  private touchingNoMine(ox: number, oy: number): Position[] {
    const position = `${ox}-${oy}` as Position;
    if (this.slots[position].hasMine) {
      throw Error("There is mine at " + position);
    }

    const result: Position[] = [];
    const stack: Position[] = [position];
    while (stack.length != 0) {
      const current = stack.pop()!;
      result.push(current);

      const [i, j] = current.split("-").map((x) => parseInt(x, 10));

      if (this.slots[current].nearbyMine > 0) continue;

      for (const { x, y } of deltaMap) {
        if (!this.isVaildPosition(x + i, y + j)) continue;

        const position = `${x + i}-${y + j}` as Position;

        if (
          this.slots[position].hasMine || this.slots[position].reveal ||
          result.includes(position) ||
          stack.includes(position)
        ) continue;

        stack.push(position);
      }
    }

    return result;
  }
  public click(x: number, y: number): {
    state: "playing" | "dead" | "win";
    reveals: RevealEvent[];
  } {
    let reveals: RevealEvent[] = [];

    if (!this.isVaildPosition(x, y)) {
      throw Error("board too small or index negative!");
    }
    this.initField(x, y);

    const position = `${x}-${y}` as Position;

    if (this.slots[position].hasMine) this.state = "dead";
    if (this.state != "playing") return { state: this.state, reveals };

    reveals = this.touchingNoMine(x, y).map((position) => {
      const slot = this.slots[position];
      slot.reveal = true;
      this.revealCount++;
      return {
        position,
        nearbyMine: slot.nearbyMine,
      };
    });

    if (this.revealCount === this.totalSpaceCount) this.state = "win";

    return {
      state: this.state,
      reveals,
    };
  }
}

Deno.test("MineBoard click on safe cell", () => {
  const fixedRandomer = () => false;
  const board = new MineBoard(5, 5, fixedRandomer);

  const result = board.click(2, 2);

  assertEquals(
    result.reveals.length,
    25,
    "Should reveal all cells",
  );
  assertEquals(
    result.state,
    "win",
    "Should win the game",
  );
});

Deno.test("MineBoard reveals with mine hints", () => {
  // 1 1 1 0 0
  // 1 x 1 0 0
  // 2 2 2 0 0
  // 1 x 1 0 0
  // 1 1 1 0 0
  const fixedRandomer = (x: number, y: number) => {
    return (x === 1 && y === 1) || (x === 1 && y === 3);
  };

  const board = new MineBoard(5, 5, fixedRandomer);

  const result = board.click(3, 2);

  result.reveals.forEach((event) => {
    assertExists(
      event.nearbyMine !== undefined,
      "Each revealed event should have nearbyMine",
    );
  });
});

Deno.test("MineBoard click on mine", () => {
  const fixedRandomer = () => true;
  const board = new MineBoard(5, 5, fixedRandomer);

  board.click(2, 3);
  const result = board.click(2, 2);

  assertEquals(result.state, "dead", "Event should be a death");
});
