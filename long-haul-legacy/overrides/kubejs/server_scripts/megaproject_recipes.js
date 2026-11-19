// ============================================================
// Long Haul Legacy — Рецепты Мегапроекта и Космической Программы
// Каждый компонент требует ресурсы из разных климатических поясов,
// что заставляет игрока строить трансконтинентальную логистику.
// ============================================================

ServerEvents.recipes(event => {
  // --- Сплавная пластина: железо + цинк (умеренный пояс, рядом со спавном) ---
  event.shaped('megaproject:alloy_plate', [
    'III',
    'IZI',
    'III'
  ], {
    I: 'minecraft:iron_ingot',
    Z: 'create:zinc_ingot'
  });

  // --- Прецизионная рама: сплавные пластины + золото + редстоун (аридный пояс) ---
  event.shaped('megaproject:precision_frame', [
    'GPG',
    'PAP',
    'GPG'
  ], {
    G: 'minecraft:gold_ingot',
    P: 'megaproject:alloy_plate',
    A: 'minecraft:redstone'
  });

  // --- Энергетическое ядро: рамы + алмазы + изумруды (тропики/полярный пояс) ---
  event.shaped('megaproject:energy_core', [
    'DED',
    'EFE',
    'DED'
  ], {
    D: 'minecraft:diamond',
    E: 'minecraft:emerald',
    F: 'megaproject:precision_frame'
  });

  // --- Катализатор запуска: ядра + незерит + дроп с боссов ---
  // Требует: 4 энергетических ядра, 1 незеритовый слиток, 1 сердце с босса Cataclysm, 1 звезда
  event.shaped('megaproject:launch_catalyst', [
    'ECE',
    'CNC',
    'ECE'
  ], {
    E: 'megaproject:energy_core',
    C: 'cataclysm:burning_ashes',  // дроп с боссов L_Ender's Cataclysm
    N: 'minecraft:netherite_ingot'
  });

  // --- Орбитальный модуль: катализаторы + материалы Ad Astra ---
  event.shaped('megaproject:orbital_module', [
    'OOO',
    'OCO',
    'OOO'
  ], {
    O: 'ad_astra:steel_plate',  // материал Ad Astra
    C: 'megaproject:launch_catalyst'
  });

  // --- Ядро Мегапроекта: 8 орбитальных модулей ---
  event.shaped('megaproject:core', [
    'OOO',
    'OCO',
    'OOO'
  ], {
    O: 'megaproject:orbital_module',
    C: 'megaproject:launch_catalyst'
  });

  // --- Стартовая площадка: ядро + незеритовые блоки ---
  event.shaped('megaproject:launch_pad', [
    'NNN',
    'NCN',
    'NNN'
  ], {
    N: 'minecraft:netherite_block',
    C: 'megaproject:core'
  });

  // --- Гейт космической программы: ракеты Ad Astra требуют катализатор ---
  // Ракеты Ad Astra крафтятся в NASA Workbench (кастомный тип рецепта),
  // поэтому гейтим их через общий компонент — обтекатель ракеты.
  // Оригинальный рецепт: стальные пластины + громоотвод.
  // Новый: стальные пластины + громоотвод + Катализатор запуска.
  event.remove({ output: 'ad_astra:rocket_nose_cone' });
  event.shaped('ad_astra:rocket_nose_cone', [
    ' C ',
    ' S ',
    'SSS'
  ], {
    C: 'megaproject:launch_catalyst',
    S: 'ad_astra:steel_plate'
  });
});
