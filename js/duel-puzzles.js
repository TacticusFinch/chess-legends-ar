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
  },
  {
    id: "m1_custom_10",
    fen: "1k1r4/1pp5/p3pQ2/2P4p/5P2/7P/PP1r2PK/8 b - - 0 29",
    move: { from: "d8", to: "g8" }
  },
  {
    id: "m1_custom_11",
    fen: "r1bqk2r/ppp2ppp/2nb4/3pn3/8/3B1N2/PPP1QPPP/RNB2RK1 w kq - 2 10",
    move: { from: "f3", to: "e5" }
  },
  {
    id: "m1_custom_12",
    fen: "1Q3bk1/p5pp/2q1p3/4P3/8/2B5/P3r1PP/2R4K w - - 4 32",
    move: { from: "b8", to: "f8" }
  },
  {
    id: "m1_custom_13",
    fen: "8/8/7p/2p1kp1P/p1P3p1/3PK1P1/1P6/8 b - - 0 43",
    move: { from: "f5", to: "f4" }
  },
  {
    id: "m1_custom_14",
    fen: "8/1p5r/2n5/7P/2P1kp2/R1P1p3/6K1/3B4 w - - 0 45",
    move: { from: "d1", to: "c2" }
  },
  {
    id: "m1_custom_15",
    fen: "r4k1r/pp3p2/4P3/qB4Qp/4b3/P1p5/1P3PPP/4K2R w K - 0 23",
    move: { from: "e6", to: "e7" }
  },
  {
    id: "m1_custom_16",
    fen: "2r1q1k1/1R5p/p3pBp1/4P3/3n4/8/P5PP/1Q4K1 b - - 3 30",
    move: { from: "c8", to: "c1" }
  },
  {
    id: "m1_custom_17",
    fen: "r1bqk2r/pp5p/2p5/3PPp2/4n1p1/B2BP3/P1Q2PPP/R3K2R b KQkq - 0 14",
    move: { from: "d8", to: "a5" }
  },
  {
    id: "m1_custom_18",
    fen: "8/1p6/p1p2p2/3pp1k1/6N1/1P1P1KP1/P7/8 b - - 0 42",
    move: { from: "e5", to: "e4" }
  },
  {
    id: "m1_custom_19",
    fen: "1k6/1pp3p1/p7/P3NpP1/3r1P2/1P1P4/2P4r/1K3R2 w - - 1 34",
    move: { from: "e5", to: "f3" }
  },
  {
    id: "m1_custom_20",
    fen: "2r3r1/pp1b1pkp/3p4/4qp1R/4P3/1PN2P2/1PPQ2P1/2K5 w - - 1 21",
    move: { from: "d2", to: "h6" }
  }
];

function getRandomDuelPuzzle() {
  const idx = Math.floor(Math.random() * DUEL_STRIKE_PUZZLES.length);
  return DUEL_STRIKE_PUZZLES[idx];
}
