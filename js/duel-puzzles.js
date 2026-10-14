/**
 * База тактических задач для интерактивного удара дуэли (Lichess & Masters)
 */
const DUEL_STRIKE_PUZZLES = [
  // --- БАЗОВЫЕ МАТОВЫЕ ПАТТЕРНЫ ---
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

  // --- КАСТОМНЫЙ ПАКЕТ 1 (1 - 25) ---
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
  },
  {
    id: "m1_custom_21",
    fen: "8/R5pk/1p3r1p/4Q3/4P3/7P/5qPK/8 b - - 4 29",
    move: { from: "f6", to: "g6" }
  },
  {
    id: "m1_custom_22",
    fen: "7r/6R1/pk2Pb2/1p5p/P7/1BP3B1/3r4/1K6 w - - 1 32",
    move: { from: "a4", to: "a5" }
  },
  {
    id: "m1_custom_23",
    fen: "rn1qkb1r/pp2pp1p/2p3p1/2PbN3/2B5/5Q2/PP1P1PPP/R1B1K2R w KQkq - 0 11",
    move: { from: "f3", to: "f7" }
  },
  {
    id: "m1_custom_24",
    fen: "8/2Q2pkp/6p1/1p1q4/4r3/P7/5PPP/2R3K1 b - - 2 28",
    move: { from: "e4", to: "c4" }
  },
  {
    id: "m1_custom_25",
    fen: "8/p1q2pkp/1p1bp1p1/8/6N1/6PP/P2Q1P2/6K1 w - - 12 37",
    move: { from: "d2", to: "h6" }
  },

  {
    id: "m1_custom_26",
    fen: "6k1/R6p/4pbp1/2Bb4/8/1PP1N2P/1P4PK/3r4 b - - 4 28",
    move: { from: "f6", to: "e5" }
  },

  {
    id: "m1_custom_27",
    fen: "r4rk1/ppqn1ppp/2pb4/3pN3/3P1B2/3Q3P/PPP2PP1/2K1R2R b - - 4 15",
    move: { from: "f7", to: "f6" }
  },
  {
    id: "m1_custom_28",
    fen: "r2r1k2/pp4pQ/1q3b1p/4p3/3p4/3B4/PP4PP/R4RK1 w - - 0 23",
    move: { from: "f1", to: "f6" }
  },
  {
    id: "m1_custom_29",
    fen: "5knR/1p3p2/6P1/2PK2P1/1r1B3P/p7/8/8 b - - 0 42",
    move: { from: "b4", to: "d4" }
  },
  {
    id: "m1_custom_30",
    fen: "r4rk1/1pp3pp/p5q1/3P4/4pp2/PP2P2b/3N1PPP/R2QRBK1 b - - 3 18",
    move: { from: "h3", to: "g2" }
  },

  // --- НОВЫЙ ТУРНИРНЫЙ ПАКЕТ 2 ---
  {
    id: "m1_custom_31",
    fen: "r3k2r/pp3ppp/1np1pq2/4N3/P7/6P1/1P1KQ1BP/R6R b kq - 2 17",
    move: { from: "f6", to: "e5" }
  },
  {
    id: "m1_custom_32",
    fen: "6k1/2Q2pbp/4p1p1/3pP3/1qnP3B/5N1P/5PPK/8 w - - 15 40",
    move: { from: "h4", to: "e7" }
  },
  {
    id: "m1_custom_33",
    fen: "2r3k1/pp1r1pbp/6p1/2qP2N1/2P5/3Q4/5RPP/5RK1 w - - 2 24",
    move: { from: "d3", to: "h3" }
  },
  {
    id: "m1_custom_34",
    fen: "r6r/1p4kq/p2P1pp1/4p1p1/2P5/6Bb/PPQR1P2/4RBK1 b - - 1 27",
    move: { from: "h3", to: "f5" }
  },
  {
    id: "m1_custom_35",
    fen: "5r2/6R1/1k2pp2/1p1r2p1/1P6/1K1P4/8/R7 w - - 2 40",
    move: { from: "a1", to: "a7" }
  },
  {
    id: "m1_custom_36",
    fen: "r5r1/p1k2p2/1ppN4/4P2p/2P3b1/1P6/P2R1P1P/2R3K1 b - - 1 26",
    move: { from: "g4", to: "e2" }
  },
  {
    id: "m1_custom_37",
    fen: "r2q1b1r/pp2kppp/5n2/1BP1N3/8/2p5/PP3PPP/R1BKR3 w - - 0 13",
    move: { from: "e5", to: "d7" }
  },
  {
    id: "m1_custom_38",
    fen: "r3k2r/pp1b1p1p/2n1pp2/q2p4/1b1P4/1QN1PNP1/PP3PBP/R3K2R b KQkq - 4 11",
    move: { from: "c6", to: "d4" }
  },
  {
    id: "m1_custom_39",
    fen: "r5k1/1pq2ppp/p4r2/2pN4/B2n4/P2P4/1P3PPQ/R4RK1 b - - 0 19",
    move: { from: "d4", to: "e2" }
  },
  {
    id: "m1_custom_40",
    fen: "6k1/5p1p/1p3qp1/1Q1B4/P4P2/1R6/2r1r1PP/3R2K1 b - - 9 31",
    move: { from: "f6", to: "d4" }
  },
  {
    id: "m1_custom_41",
    fen: "3r2k1/1p1n1bp1/pq4Qp/8/3p1B2/1P4P1/P5BP/4R2K w - - 4 25",
    move: { from: "f4", to: "c7" }
  },
  {
    id: "m1_custom_42",
    fen: "7k/1R6/1p5p/7K/1r3P2/8/8/8 w - - 3 52",
    move: { from: "h5", to: "g6" }
  },
  {
    id: "m1_custom_43",
    fen: "1k1r3r/1p2bpp1/p1p1p1p1/3qP3/P2P1N1n/4B2P/1PQ2PP1/2R2RK1 b - - 3 20",
    move: { from: "d5", to: "g2" }
  },
  {
    id: "m1_custom_44",
    fen: "r2nr2k/3q3p/6pN/p2p2P1/3P4/2P2Q1P/6K1/5R2 w - - 0 38",
    move: { from: "f3", to: "f8" }
  },
  {
    id: "m1_custom_45",
    fen: "r2k3r/pp3R2/8/5q2/2B5/3P1N2/PP3P2/R2Q1bK1 b - - 7 29",
    move: { from: "h8", to: "h1" }
  },
  {
    id: "m1_custom_46",
    fen: "r1b2rk1/3p1pp1/p3p2p/3pP2Q/8/6RR/P1q2PPP/6K1 w - - 0 21",
    move: { from: "g3", to: "g7" }
  },
  {
    id: "m1_custom_47",
    fen: "6k1/1p3pp1/p6p/4r2q/1P1Rb3/PQ4P1/5P1P/4R1K1 b - - 0 32",
    move: { from: "h5", to: "h2" }
  },
  {
    id: "m1_custom_48",
    fen: "r1q2knr/3n1pp1/p2pP2p/3Q2N1/8/2N1P3/PP5P/2Kb1B2 w - - 0 20",
    move: { from: "e6", to: "e7" }
  },

{
    id: "m1_custom_49",
    fen: "5r1k/2B3pp/5qp1/8/1Q6/5P2/P2R3P/3r1BK1 b - - 4 27",
    move: { from: "d1", to: "f1" }
  },
  {
    id: "m1_custom_50",
    fen: "r4rk1/pp3pp1/5nn1/2p1p3/2P3b1/3B1Nq1/PPQ3PR/1K5R w - - 6 24",
    move: { from: "h2", to: "h8" }
  },
  {
    id: "m1_custom_51",
    fen: "5Q2/1k1r2p1/p7/1p5p/4Pb2/P1P2N1q/1P2K3/1R3R2 b - - 0 32",
    move: { from: "d7", to: "d2" }
  },
  {
    id: "m1_custom_52",
    fen: "rn2kb1r/ppp2ppp/4b3/3QP3/8/5N2/PqPB2PP/3RKB1R w Kkq - 2 13",
    move: { from: "d5", to: "d8" }
  },
  {
    id: "m1_custom_53",
    fen: "5rk1/p1p2r1p/6pP/1p6/6q1/1QPP4/PP6/4RR1K w - - 0 28",
    move: { from: "b3", to: "f7" }
  },
  {
    id: "m1_custom_54",
    fen: "1r2nrk1/2p4p/3p2pQ/1q1Pp1PN/p3P3/P4P2/1Pp5/2K3RR w - - 3 26",
    move: { from: "h6", to: "h7" }
  },
  {
    id: "m1_custom_55",
    fen: "rnb2rk1/ppp1nppp/2q5/2b1p1B1/2B1P3/2N2Q2/PPP2PPP/3RK1NR w K - 4 9",
    move: { from: "f3", to: "f7" }
  },
  {
    id: "m1_custom_56",
    fen: "6rk/5pp1/pq3n2/1p1pNQ1b/1P1n3P/2r1P3/P1BN1K2/6RR w - - 0 32",
    move: { from: "f5", to: "h5" }
  },
  {
    id: "m1_custom_57",
    fen: "7b/1b3pkp/2p1p1p1/1pPpN1B1/3P1P1Q/2n1PR1P/r3q1P1/6K1 w - - 2 41",
    move: { from: "g5", to: "h6" }
  },
  {
    id: "m1_custom_58",
    fen: "r3r1k1/pp2q2n/1np1b1BP/3p2Q1/3P4/2P2P2/P1P3P1/R4RK1 w - - 1 22",
    move: { from: "g6", to: "f7" }
  },
  {
    id: "m1_custom_59",
    fen: "1k6/pb1q1p2/1p3p2/5N1p/1Q1pPK2/3P1B1r/PPR2P2/8 b - - 1 27",
    move: { from: "d7", to: "f5" }
  },
  {
    id: "m1_custom_60",
    fen: "r3kb1r/pp3ppp/3p4/2p1q3/2B3Q1/8/PP1P2PP/n1B2RK1 w kq - 0 15",
    move: { from: "c4", to: "b5" }
  },
  {
    id: "m1_custom_61",
    fen: "2b2rk1/6bp/p3p1p1/2pqP3/2np1PP1/3B2B1/P1P4Q/1K1R3R b - - 0 25",
    move: { from: "d5", to: "b7" }
  },
  {
    id: "m1_custom_62",
    fen: "4rk2/Q4pp1/3b3p/P7/8/7P/6P1/6K1 b - - 2 36",
    move: { from: "d6", to: "g3" }
  },
  {
    id: "m1_custom_63",
    fen: "5r1k/6p1/p6p/3p4/2RQ4/P4BKP/1q6/8 b - - 0 39",
    move: { from: "b2", to: "b8" }
  },
  {
    id: "m1_custom_64",
    fen: "6k1/pp2Rqpp/1n6/2pp1rB1/5P2/2P4P/PPPQ4/1K6 b - - 3 22",
    move: { from: "f5", to: "g5" }
  },
  {
    id: "m1_custom_65",
    fen: "2Rb2k1/pp3ppp/1q6/3P4/6Pn/1P2r2P/P2Q4/7K w - - 2 31",
    move: { from: "d2", to: "e3" }
  }
];

function getRandomDuelPuzzle() {
  const idx = Math.floor(Math.random() * DUEL_STRIKE_PUZZLES.length);
  return DUEL_STRIKE_PUZZLES[idx];
}