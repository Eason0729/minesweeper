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

  private mineCount: number;
  public state: "playing" | "dead" | "win" = "playing";
  public revealCount: number = 0;

  public width: number;
  public height: number;
  private fieldInited: boolean = false;

  constructor(
    width: number,
    height: number,
    mineCount: number,
  );
  constructor(
    width: number,
    height: number,
    slots: string,
  );
  constructor(
    width: number,
    height: number,
    mineCountOrSlots: number | string = 0,
  ) {
    if (typeof mineCountOrSlots === "string") {
      console.warn("running test, MineBoard is not verified");
      const rows = mineCountOrSlots.trim().split("\n")
        .map((row) => row.trim().split(/\s+/));

      this.width = rows[0].length;
      this.height = rows.length;
      this.mineCount = 0;

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const hasMine = rows[y][x] === "x";
          const position = `${x}-${y}` as Position;

          this.slots[position] = new MineSlot(hasMine);

          if (hasMine) {
            this.mineCount++;
          }
        }
      }
      this.fieldInited = true;
      this.initNearbyMine();
    } else {
      this.width = width;
      this.height = height!;
      this.mineCount = mineCountOrSlots!;
      if (mineCountOrSlots! >= width * height) {
        throw Error("Too many mines");
      }
    }
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

    const positions = Array.from(
      { length: this.width * this.height },
      (_, index) =>
        `${Math.floor(index / this.width)}-${index % this.height}` as Position,
    ).filter((position) => position !== clickPosition);

    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    positions.push(clickPosition);

    positions.forEach((position, i) => {
      this.slots[position] = new MineSlot(i < this.mineCount);
    });

    this.initNearbyMine();
  }
  private initNearbyMine() {
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

    if (this.revealCount === (this.width * this.height - this.mineCount)) {
      this.state = "win";
    }

    return {
      state: this.state,
      reveals,
    };
  }
}

Deno.test("MineBoard init", () => {
  const board = new MineBoard(5, 5, 24);

  assertEquals(board.width, 5);
  assertEquals(board.height, 5);

  const result = board.click(2, 2);

  assertEquals(result.state, "win");
});

Deno.test("MineBoard click on safe cell", () => {
  const board = new MineBoard(5, 5, 0);

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
  const seed = `
  _ _ _ _ _
  _ x _ _ _
  _ _ _ _ _
  _ x _ _ _
  _ _ _ _ _`;
  const board = new MineBoard(5, 5, seed);

  const result = board.click(3, 2);

  result.reveals.forEach((event) => {
    assertExists(
      event.nearbyMine !== undefined,
      "Each revealed event should have nearbyMine",
    );
  });
});

Deno.test("MineBoard click on mine", () => {
  const seed = `
  _ _ _ _ _
  _ _ _ _ _
  _ _ x _ _
  _ _ _ _ _
  _ _ _ _ _`;

  const board = new MineBoard(5, 5, seed);

  board.click(2, 3);
  const result = board.click(2, 2);

  assertEquals(result.state, "dead", "Event should be a death");
});
