/**
 * Copyright details for every photograph on the site. Change the owner, the
 * wording or the website here and the footer, the right-click notice, the
 * album page metadata and the copyright tag inside each served photo all follow.
 */
const holder = 'One Small Photo';

export const copyright = {
  holder,
  website: 'https://photo.onesmall.company',
  /** Short notice for the footer and image metadata. */
  notice: `© ${holder}. All rights reserved.`,
  /** Shown when someone right-clicks or long-presses a protected photograph. */
  protectedMessage: `© ${holder}. This photograph is protected by copyright. Unauthorized downloading, copying, or redistribution is prohibited.`,
} as const;
