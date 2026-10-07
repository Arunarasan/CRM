// Two kinds of "add" live on the quote sheet and must never look alike:
//  • Category — a group (Curtains, Wallpaper…): amber, folder icon, dashed, at the BOTTOM of the sheet.
//  • Product  — a line inside a group: green, box icon, solid, in the toolbar and at the foot of each category.
// Colour is never the only cue — icon, wording and position differ as well.

export const CATEGORY_TONE = {
  /** Main "create a category" button (empty sheet). */
  solid: "bg-[#B45309] hover:bg-[#92400E] text-white",
  /** The dashed "New category" bar under the last category. */
  soft: "border-2 border-dashed border-[#F59E0B]/70 bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7] hover:border-[#D97706]",
  /** Category header strip. */
  header: "bg-[#FFF7ED]",
  icon: "text-[#D97706]",
  /** Selected category chip in the add panel. */
  chipOn: "border-[#D97706] bg-[#FFF7ED] text-[#92400E]",
};

export const PRODUCT_TONE = {
  /** Toolbar "Add product" and the panel's "Add to …" button. */
  solid: "bg-[#1F5C3F] hover:bg-[#184A33] text-white",
  /** "Add product to <category>" at the foot of each category. */
  soft: "border border-[#A7F3D0] bg-[#ECFDF5] text-[#14532D] hover:bg-[#D1FAE5] hover:border-[#6EE7B7]",
};
