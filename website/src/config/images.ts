/**
 * Centralized image configuration. Every image URL in the site resolves through here,
 * so swapping stock photography for JB Decor's real brand assets later is a one-file change.
 * Currently uses licensed-for-use Unsplash interior photography.
 */

/** Build a sized, optimized Unsplash URL from a photo id. */
function u(id: string, w = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`
}

export const images = {
  hero: {
    livingRoom: u('1618221195710-dd6b41faaea6', 1920),
    lounge: u('1616486338812-3dadae4b4ace', 1920),
    diningHall: u('1567016376408-0226e4d0c1ea', 1920),
  },
  products: {
    chandelier: u('1513506003901-1e6a229e2d15', 800),
    velvetChair: u('1595515106969-1ce29566ff1c', 800),
    coffeeTable: u('1533090161767-e6ffed986c88', 800),
    tableLamp: u('1550581190-9c1c48d21d6c', 800),
    sofa: u('1493663284031-b7e3aefcae8e', 800),
    sideboard: u('1524758631624-e2822e304c36', 800),
  },
  portfolio: {
    residential: u('1600210492486-724fe5c67fb0', 1000),
    villa: u('1616594039964-ae9021a400a0', 1000),
    apartment: u('1616137466211-f939a420be84', 1000),
    office: u('1519710164239-da123dc03ef4', 1000),
    kitchen: u('1556909212-d5b604d0c90d', 1000),
    bedroom: u('1560448204-e02f11c3d0e2', 1000),
  },
  services: {
    interiorDesign: u('1618221195710-dd6b41faaea6', 900),
    modularKitchen: u('1556909212-d5b604d0c90d', 900),
    wardrobe: u('1595428774223-ef52624120d2', 900),
    lighting: u('1550581190-9c1c48d21d6c', 900),
    falseCeiling: u('1616627561839-074385245ff6', 900),
    turnkey: u('1616486338812-3dadae4b4ace', 900),
  },
  designStudio: u('1618221195710-dd6b41faaea6', 1200),
  consultationCta: u('1522708323590-d24dbb6b0267', 1400),
  aboutStudio: u('1524758631624-e2822e304c36', 1200),
}

/** A small neutral placeholder used while images load / on error. */
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Crect width='4' height='3' fill='%23e7e0d1'/%3E%3C/svg%3E"
