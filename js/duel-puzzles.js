/**
 * База тактических задач для интерактивного удара дуэли (Lichess)
 */
const DUEL_STRIKE_PUZZLES = [
  {
    id: "m1_queen_f7",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    move: { from: "f3", to: "f7" }
  },
  {
    id: "m1_backrank_rook",
    fen: "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
    move: { from: "b1", to: "b8" }
  },
  {
    id: "m1_queen_backrank",
    fen: "6k1/5ppp/8/8/8/5N2/5PPP/4Q1K1 w - - 0 1",
    move: { from: "e1", to: "e8" }
  },
  {
    id: "m1_battery_g7",
    fen: "r1b2rk1/pp3ppp/8/3p4/1b1B4/6Q1/PPP2PPP/2KR1B1R w - - 0 1",
    move: { from: "g3", to: "g7" }
  },
  {
    id: "m1_custom_1",
    fen: "5rk1/3PR1pp/p2r2p1/1p6/8/4P2Q/3q1PPP/5RK1 b - - 2 29",
    move: { from: "d2", to: "f2" }
  },
  {
    id: "m1_custom_2",
    fen: "3r2k1/R5bp/3q1pp1/8/3R4/1r2BQ1P/1P3PP1/6K1 b - - 0 24",
    move: { from: "d6", to: "d4" }
  },
  {
    id: "m1_custom_3",
    fen: "6k1/5pp1/7p/2p5/2n1P3/2q5/4QPPP/rR3NK1 w - - 3 28",
    move: { from: "b1", to: "a1" }
  },
  {
    id: "m1_custom_4",
    fen: "6k1/1b3pp1/7p/PR3P2/7P/6P1/1r2BK2/8 b - - 7 52",
    move: { from: "b2", to: "e2" }
  },
  {
    id: "m1_custom_5",
    fen: "r1bqk2r/pp1n1ppp/4pn2/4P1B1/8/P4N2/2P2KPP/RN1Q1B1R b kq - 0 10",
    move: { from: "f6", to: "e4" }
  },
  {
    id: "m1_custom_6",
    fen: "kr3b1r/ppQ3p1/8/1q2p1pp/6nP/8/PP3PP1/2RR2K1 w - - 0 24",
    move: { from: "c7", to: "b8" }
  },
  {
    id: "m1_custom_7",
    fen: "r1b4k/p3R1pp/8/1p1r1p2/1Pn5/P5P1/1B2PP1P/5RK1 w - - 2 23",
    move: { from: "e7", to: "e8" }
  },
  {
    id: "m1_custom_8",
    fen: "r3rk2/4ppbQ/3p2p1/qBp5/4nNP1/1PP5/1BP5/2KR3R b - - 0 21",
    move: { from: "a5", to: "a1" }
  },
  {
    id: "m1_custom_9",
    fen: "1r2r1k1/p3qppp/2p5/2B5/8/1PbP1P2/P1P1RQPP/4R2K b - - 0 24",
    move: { from: "c3", to: "e1" }
  }
];

function getRandomDuelPuzzle() {
  const idx = Math.floor(Math.random() * DUEL_STRIKE_PUZZLES.length);
  return DUEL_STRIKE_PUZZLES[idx];
}
