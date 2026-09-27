export type NonLocalized = <Literal extends string>(text: Literal) => Literal;

/**
 * Marks an intentional user-facing literal that must not be translated.
 *
 * This helper performs no runtime transformation. Keep the argument as a
 * static string literal so localization lint can audit every escape hatch.
 */
export const NL: NonLocalized = (text) => text;
