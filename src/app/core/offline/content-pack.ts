/**
 * A small, bundled library of grade 4-8 topic notes that ships with the app
 * (and is cached by the service worker), so the offline model can ground its
 * answers in real content instead of only its own parametric memory — the
 * "cached-content Q&A" the offline mode is scoped to (see
 * docs/ARCHITECTURE.md and offline-persona.ts).
 *
 * The notes are original, concise summaries written for this project — not
 * copied from any source — so there's no licensing/attribution to carry.
 * Maths is written in plain text (e.g. 1/4, 3 x 4 = 12), matching the
 * offline persona's formatting rules.
 */

export type ContentSubject = 'math' | 'science' | 'reading';

export interface ContentNote {
  id: string;
  subject: ContentSubject;
  title: string;
  /** Lower-case whole-word triggers used by the keyword retriever. */
  keywords: string[];
  /** 2-4 plain-text sentences. Kept short so several fit in the prompt. */
  body: string;
}

export const CONTENT_PACK: readonly ContentNote[] = [
  // ---- Math ----
  {
    id: 'math-fractions',
    subject: 'math',
    title: 'Fractions',
    keywords: ['fraction', 'fractions', 'numerator', 'denominator', 'half', 'quarter', 'third'],
    body: 'A fraction shows part of a whole, written as a top number over a bottom number, like 3/4. The top number (numerator) is how many parts you have; the bottom number (denominator) is how many equal parts the whole is split into. So 3/4 means 3 out of 4 equal parts.',
  },
  {
    id: 'math-adding-fractions',
    subject: 'math',
    title: 'Adding and subtracting fractions',
    keywords: ['add fractions', 'adding fractions', 'subtract fractions', 'common denominator', 'like fractions'],
    body: 'When two fractions have the same bottom number, you add or subtract just the top numbers: 1/4 + 2/4 = 3/4. When the bottom numbers are different, first rewrite them so they match (a common denominator), then add the tops. For example 1/2 + 1/3 becomes 3/6 + 2/6 = 5/6.',
  },
  {
    id: 'math-equivalent-fractions',
    subject: 'math',
    title: 'Equivalent fractions',
    keywords: ['equivalent fraction', 'equivalent fractions', 'simplify', 'simplifying', 'reduce fraction'],
    body: 'Equivalent fractions are different ways of writing the same amount, like 1/2 = 2/4 = 3/6. You get one by multiplying or dividing the top and bottom by the same number. Simplifying means dividing both by the largest number that fits, so 4/8 becomes 1/2.',
  },
  {
    id: 'math-decimals',
    subject: 'math',
    title: 'Decimals',
    keywords: ['decimal', 'decimals', 'decimal point', 'tenths', 'hundredths'],
    body: 'A decimal is another way to write a fraction using a point, where digits after the point show tenths, hundredths, and so on. For example 0.5 is the same as 1/2, and 0.25 is the same as 1/4. Line up the decimal points when you add or subtract them.',
  },
  {
    id: 'math-percentages',
    subject: 'math',
    title: 'Percentages',
    keywords: ['percent', 'percentage', 'percentages', 'per cent'],
    body: 'A percentage is a fraction out of 100, shown with a % sign. So 25% means 25 out of 100, which is the same as 1/4 or 0.25. To find 25% of a number, multiply by 0.25 — for example 25% of 40 = 10.',
  },
  {
    id: 'math-ratios',
    subject: 'math',
    title: 'Ratios and rates',
    keywords: ['ratio', 'ratios', 'rate', 'rates', 'proportion'],
    body: 'A ratio compares two amounts, written like 2:3, meaning 2 of one thing for every 3 of another. A rate is a ratio between two different units, like 60 km in 1 hour (60 km/h). You can scale a ratio up or down by multiplying both sides by the same number.',
  },
  {
    id: 'math-negative-numbers',
    subject: 'math',
    title: 'Negative numbers',
    keywords: ['negative', 'negatives', 'integer', 'integers', 'number line', 'below zero'],
    body: 'Negative numbers are less than zero, like -3, and sit to the left of zero on a number line. Adding a negative moves left, subtracting a negative moves right. For example 2 + (-5) = -3, and 2 - (-5) = 7.',
  },
  {
    id: 'math-algebra',
    subject: 'math',
    title: 'Basic algebra',
    keywords: ['algebra', 'variable', 'variables', 'expression', 'equation', 'solve for x'],
    body: 'In algebra a letter like x stands for an unknown number. An expression such as 2x + 3 is a rule; an equation such as 2x + 3 = 11 says two things are equal. To solve it, do the same operation to both sides until x is alone: subtract 3 to get 2x = 8, then divide by 2 to get x = 4.',
  },
  {
    id: 'math-order-of-operations',
    subject: 'math',
    title: 'Order of operations',
    keywords: ['order of operations', 'bodmas', 'bidmas', 'pemdas', 'brackets first'],
    body: 'When a sum has several operations, do them in order: brackets first, then powers, then multiply and divide (left to right), then add and subtract (left to right). For example 2 + 3 x 4 = 2 + 12 = 14, not 20, because multiplication comes before addition.',
  },
  {
    id: 'math-area-perimeter',
    subject: 'math',
    title: 'Area and perimeter',
    keywords: ['area', 'perimeter', 'rectangle', 'square units'],
    body: 'Perimeter is the distance all the way around a shape — add up every side. Area is the space inside, measured in square units. For a rectangle, perimeter = 2 x (length + width) and area = length x width. A 5 by 3 rectangle has perimeter 16 and area 15.',
  },
  {
    id: 'math-volume',
    subject: 'math',
    title: 'Volume',
    keywords: ['volume', 'cubic', 'cuboid', 'box', 'capacity'],
    body: 'Volume is how much space a solid shape takes up, measured in cubic units. For a box (cuboid), volume = length x width x height. A box that is 2 by 3 by 4 has a volume of 24 cubic units.',
  },
  {
    id: 'math-prime-numbers',
    subject: 'math',
    title: 'Prime and composite numbers',
    keywords: ['prime', 'primes', 'composite', 'factor', 'factors', 'multiple', 'multiples'],
    body: 'A prime number has exactly two factors: 1 and itself, like 2, 3, 5, 7, and 11. A composite number has more than two factors, like 6 (1, 2, 3, 6). A factor divides a number evenly; a multiple is what you get by counting up in that number.',
  },
  {
    id: 'math-rounding',
    subject: 'math',
    title: 'Rounding and place value',
    keywords: ['rounding', 'round', 'place value', 'nearest ten', 'estimate'],
    body: 'Place value tells you what each digit is worth — in 348 the 3 means 300. To round, look at the digit to the right of the place you want: 5 or more rounds up, less than 5 rounds down. So 348 to the nearest ten is 350, and to the nearest hundred is 300.',
  },
  {
    id: 'math-angles',
    subject: 'math',
    title: 'Angles',
    keywords: ['angle', 'angles', 'degrees', 'right angle', 'acute', 'obtuse'],
    body: 'An angle measures a turn between two lines, in degrees. A right angle is exactly 90 degrees (a square corner); an acute angle is smaller than 90; an obtuse angle is between 90 and 180. Angles on a straight line add up to 180 degrees.',
  },

  // ---- Science ----
  {
    id: 'sci-photosynthesis',
    subject: 'science',
    title: 'Photosynthesis',
    keywords: ['photosynthesis', 'plants make food', 'chlorophyll', 'sunlight', 'oxygen'],
    body: 'Photosynthesis is how green plants make their own food. Leaves take in sunlight, water from the roots, and carbon dioxide from the air, and turn them into sugar for energy. They release oxygen as they do it, which is the air we breathe.',
  },
  {
    id: 'sci-water-cycle',
    subject: 'science',
    title: 'The water cycle',
    keywords: ['water cycle', 'evaporation', 'condensation', 'precipitation', 'rain', 'clouds'],
    body: 'The water cycle is how water moves around the Earth. The Sun heats water so it evaporates into vapour, which rises and cools to form clouds (condensation). When the drops get heavy they fall as rain or snow (precipitation) and flow back to rivers and seas.',
  },
  {
    id: 'sci-states-of-matter',
    subject: 'science',
    title: 'States of matter',
    keywords: ['solid', 'liquid', 'gas', 'states of matter', 'melting', 'freezing', 'evaporating'],
    body: 'Matter usually comes in three states: solid, liquid, and gas. Solids keep their shape, liquids flow and take the shape of their container, and gases spread out to fill any space. Heating can melt a solid to a liquid and then boil it to a gas; cooling reverses it.',
  },
  {
    id: 'sci-solar-system',
    subject: 'science',
    title: 'The solar system',
    keywords: ['solar system', 'planet', 'planets', 'sun', 'orbit', 'earth', 'moon'],
    body: 'The solar system is the Sun and everything that orbits it, including eight planets. In order from the Sun they are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. Earth is the third planet and the only one known to have life.',
  },
  {
    id: 'sci-food-chains',
    subject: 'science',
    title: 'Food chains',
    keywords: ['food chain', 'food chains', 'predator', 'prey', 'producer', 'consumer', 'ecosystem'],
    body: 'A food chain shows how energy passes from one living thing to another. It starts with a producer (usually a plant), which is eaten by a consumer, which may be eaten by a predator. For example: grass to rabbit to fox.',
  },
  {
    id: 'sci-forces-gravity',
    subject: 'science',
    title: 'Forces and gravity',
    keywords: ['force', 'forces', 'gravity', 'friction', 'push', 'pull', 'weight'],
    body: 'A force is a push or a pull that can make things speed up, slow down, or change direction. Gravity is the force that pulls objects toward each other — it is what keeps us on the ground and makes things fall. Friction is a force that slows things down when surfaces rub together.',
  },
  {
    id: 'sci-electricity',
    subject: 'science',
    title: 'Electricity and circuits',
    keywords: ['electricity', 'circuit', 'circuits', 'battery', 'current', 'conductor', 'insulator'],
    body: 'Electricity is a form of energy that flows as a current through a circuit. A simple circuit needs a power source like a battery, wires, and something to power such as a bulb, all connected in a loop. Conductors like metal let current flow; insulators like plastic stop it.',
  },
  {
    id: 'sci-human-body',
    subject: 'science',
    title: 'Human body systems',
    keywords: ['body system', 'body systems', 'organ', 'organs', 'heart', 'lungs', 'digestion', 'skeleton'],
    body: 'The body is made of systems that each do a job. The circulatory system moves blood using the heart; the respiratory system takes in oxygen using the lungs; the digestive system breaks down food for energy; and the skeleton supports the body and protects organs.',
  },
  {
    id: 'sci-cells',
    subject: 'science',
    title: 'Cells',
    keywords: ['cell', 'cells', 'nucleus', 'living things', 'microscope'],
    body: 'Cells are the tiny building blocks that all living things are made of, too small to see without a microscope. Each cell has parts that do jobs, like the nucleus that controls the cell. Some living things are a single cell; others, like humans, have trillions.',
  },
  {
    id: 'sci-weather',
    subject: 'science',
    title: 'Weather and climate',
    keywords: ['weather', 'climate', 'temperature', 'season', 'seasons', 'wind'],
    body: 'Weather is what the air is doing day to day — sunny, rainy, windy, hot, or cold. Climate is the usual pattern of weather in a place over many years. Seasons change because the Earth is tilted as it orbits the Sun, so different parts get more or less sunlight through the year.',
  },

  // ---- Reading & English ----
  {
    id: 'eng-parts-of-speech',
    subject: 'reading',
    title: 'Nouns, verbs, and adjectives',
    keywords: ['noun', 'nouns', 'verb', 'verbs', 'adjective', 'adjectives', 'parts of speech'],
    body: 'A noun is a person, place, thing, or idea, like dog, school, or happiness. A verb is an action or a state of being, like run, is, or think. An adjective describes a noun, like the big red ball — big and red are adjectives.',
  },
  {
    id: 'eng-sentences',
    subject: 'reading',
    title: 'Sentences',
    keywords: ['sentence', 'sentences', 'subject', 'predicate', 'complete sentence'],
    body: 'A complete sentence tells a whole idea and has two main parts: a subject (who or what the sentence is about) and a predicate (what they do or are). In "The dog barked," the dog is the subject and barked is the predicate. It starts with a capital letter and ends with punctuation.',
  },
  {
    id: 'eng-punctuation',
    subject: 'reading',
    title: 'Punctuation',
    keywords: ['punctuation', 'full stop', 'period', 'comma', 'question mark', 'exclamation'],
    body: 'Punctuation marks help a reader understand a sentence. A full stop (.) ends a statement, a question mark (?) ends a question, and an exclamation mark (!) shows strong feeling. A comma (,) shows a short pause or separates items in a list.',
  },
  {
    id: 'eng-main-idea',
    subject: 'reading',
    title: 'Main idea and details',
    keywords: ['main idea', 'detail', 'details', 'summary', 'summarize', 'comprehension'],
    body: 'The main idea is what a piece of writing is mostly about — the big point. Supporting details are the smaller facts and examples that back it up. A good summary names the main idea in your own words and includes only the most important details.',
  },
  {
    id: 'eng-synonyms-antonyms',
    subject: 'reading',
    title: 'Synonyms and antonyms',
    keywords: ['synonym', 'synonyms', 'antonym', 'antonyms', 'opposite', 'similar meaning'],
    body: 'A synonym is a word that means almost the same as another word, like big and large. An antonym is a word that means the opposite, like hot and cold. Knowing both helps you vary your writing and understand new words.',
  },
  {
    id: 'eng-figurative-language',
    subject: 'reading',
    title: 'Similes and metaphors',
    keywords: ['simile', 'similes', 'metaphor', 'metaphors', 'figurative language'],
    body: 'A simile compares two things using like or as, such as "as brave as a lion." A metaphor says one thing is another, such as "the classroom was a zoo." Both are figurative language — they paint a picture rather than being literally true.',
  },
];

function keywordHits(text: string, keyword: string): boolean {
  // Phrase keywords ("adding fractions") are matched as substrings; single
  // words use a word boundary so "art" doesn't match "start".
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

/**
 * Finds the notes most relevant to a learner's message by keyword/title
 * overlap. Cheap and synchronous — no model, no index — so it adds nothing
 * to reply latency. Returns at most `limit` notes, best first, or [] when
 * nothing matches (the offline persona then just replies generally).
 */
export function findRelevantNotes(message: string, limit = 2): ContentNote[] {
  const text = ` ${message.toLowerCase()} `;

  const scored = CONTENT_PACK.map((note) => {
    let score = 0;

    for (const keyword of note.keywords) {
      if (keywordHits(text, keyword)) {
        score += 2;
      }
    }

    for (const titleWord of note.title.toLowerCase().split(/\s+/)) {
      if (titleWord.length > 3 && keywordHits(text, titleWord)) {
        score += 1;
      }
    }

    return { note, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.note);
}
