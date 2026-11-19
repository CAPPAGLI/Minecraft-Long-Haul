// ============================================================
// Long Haul Legacy — Инженерный Мегапроект и Космическая Программа
// Кастомные предметы и блоки (KubeJS Startup)
// ============================================================

StartupEvents.registry('item', event => {
  // Базовый компонент: сплавная пластина (требует железо + цинк из умеренного пояса)
  event.create('megaproject:alloy_plate')
    .displayName('Сплавная пластина')
    .tooltip('Компонент Инженерного Мегапроекта. Требует железо и цинк умеренного пояса.');

  // Средний компонент: прецизионная рама (требует золото + редстоун из аридного пояса)
  event.create('megaproject:precision_frame')
    .displayName('Прецизионная рама')
    .tooltip('Компонент Инженерного Мегапроекта. Требует золото и редстоун аридного пояса.');

  // Продвинутый компонент: энергетическое ядро (требует алмазы + изумруды из тропиков/полярного пояса)
  event.create('megaproject:energy_core')
    .displayName('Энергетическое ядро')
    .tooltip('Компонент Инженерного Мегапроекта. Требует алмазы и изумруды тропиков и полярного пояса.');

  // Финальный катализатор: требует дроп с боссов + незерит + материалы Ad Astra
  event.create('megaproject:launch_catalyst')
    .displayName('Катализатор запуска')
    .tooltip('Финальный компонент. Требует дроп с боссов, незерит и материалы космической программы.');

  // Космический компонент: требует Ad Astra материалы
  event.create('megaproject:orbital_module')
    .displayName('Орбитальный модуль')
    .tooltip('Компонент Космической Программы. Требует материалы Ad Astra.');
});

StartupEvents.registry('block', event => {
  // Ядро Мегапроекта — центральный блок конструкции
  event.create('megaproject:core')
    .displayName('Ядро Мегапроекта')
    .stoneSoundType()
    .hardness(5.0)
    .resistance(10.0)
    .requiresTool();

  // Космический стартовый комплекс
  event.create('megaproject:launch_pad')
    .displayName('Стартовая площадка')
    .stoneSoundType()
    .hardness(5.0)
    .resistance(10.0)
    .requiresTool();
});
