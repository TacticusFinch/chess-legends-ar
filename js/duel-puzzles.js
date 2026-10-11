/**
 * База тактических задач на мат в 1 ход для интерактивного удара дуэли (Lichess Mate in 1)
 */
const DUEL_STRIKE_PUZZLES = [
  {
    id: "m1_queen_f7",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    move: { from: "f3", to: "f7" },
    desc: "Ход белых. Поставьте мат в 1 ход ферзём!"
  },
  {
    id: "m1_backrank_rook",
    fen: "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
    move: { from: "b1", to: "b8" },
    desc: "Ход белых. Линейный мат ладьёй по 8-й горизонтали!"
  },
  {
    id: "m1_queen_backrank",
    fen: "6k1/5ppp/8/8/8/5N2/5PPP/4Q1K1 w - - 0 1",
    move: { from: "e1", to: "e8" },
    desc: "Ход белых. Вторжение ферзя на последнюю горизонталь!"
  },
  {
    id: "m1_battery_g7",
    fen: "r1b2rk1/pp3ppp/8/3p4/1b1B4/6Q1/PPP2PPP/2KR1B1R w - - 0 1",
    move: { from: "g3", to: "g7" },
    desc: "Ход белых. Батарея ферзя и слона. Мат пункту g7!"
  },
  {
    id: "m1_bishop_f7",
    fen: "r1bqk2r/pppp1ppp/2n5/4P3/1bB1n3/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 1",
    move: { from: "c4", to: "f7" },
    desc: "Ход белых. Удар белопольным слоном по королю!"
  },
  {
    id: "m1_smothered_knight",
    fen: "6k1/5p1p/6p1/8/8/8/5qPP/4n2K b - - 0 1",
    move: { from: "f2", to: "g2" },
    desc: "Ход чёрных. Завершите атаку смертельным матом!"
  },
  {
    id: "m1_rook_seventh",
    fen: "3r2k1/ppp2ppp/8/8/8/8/1R4PP/1R4K1 w - - 0 1",
    move: { from: "b2", to: "b8" },
    desc: "Ход белых. Сдвоенные ладьи атакуют последний ряд!"
  },
  {
    id: "m1_pawn_mate",
    fen: "8/8/8/8/8/5K1k/6p1/7R b - - 0 1",
    move: { from: "g2", to: "h1", promotion: "q" },
    desc: "Ход чёрных. Пешка наносит решающий удар!"
  }
];

// Функция получения случайной задачи
function getRandomDuelPuzzle() {
  const idx = Math.floor(Math.random() * DUEL_STRIKE_PUZZLES.length);
  return DUEL_STRIKE_PUZZLES[idx];
}