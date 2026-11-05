MARIENEL CASTILLO - PORTFOLIO SITE
==================================

FILES
  index.html              Home page (previews)
  graphic-design.html     Graphic Design tab
  digital-art.html        Digital Art tab
  other-projects.html     Other Projects tab
  my-profile.html         My Profile tab
  css/style.css           All colors, fonts and layout (shared by every page)
  js/script.js            Phone menu + click-to-enlarge images
  images/                 Your artwork (placeholders for now)
  assets/                 Your resume PDF

OPEN IT
  Double-click index.html. No install or build step needed.
  (The fonts load from Google Fonts, so they need an internet connection.
   Offline, the site falls back to Georgia and Segoe UI.)

REPLACING THE PLACEHOLDER IMAGES
  1. Put your image in the matching folder (images/graphic-design/,
     images/digital-art/, images/projects/).
  2. In the page's HTML, change the file name in src="..." to yours.
     Example:  src="images/graphic-design/gd-01.svg"
          ->   src="images/graphic-design/my-poster.jpg"
  3. Change the alt="..." text to describe the image, and the caption text
     under it ("Add a title and what it was for") to your own.
  Hero: images/hero-photo.svg and images/hero-avatar.svg. Use PNG cut-outs
  with a transparent background, about 600 x 900 px.
  Tip: export images at about 1200 px on the long side as JPG or WebP so the
  site loads fast.

ADDING OR REMOVING A PIECE
  Each piece is one <figure class="work"> ... </figure> block. Copy one to add,
  delete one to remove. The home page shows the first 4 of each gallery.

CHANGING COLORS
  Open css/style.css and edit the values at the top, under :root.

RESUME
  assets/Marienel-Castillo-Resume.pdf is a public copy WITHOUT your phone
  number or street address. Replace it with a new PDF of the same name
  whenever you update your resume.

PUT IT ONLINE WITH VERCEL
  Option A: push this folder to a GitHub repository, then on vercel.com choose
            Add New > Project, import the repository, leave every setting as
            it is and click Deploy.
  Option B: install the Vercel CLI and run "vercel" inside this folder.
  Turn on two-factor authentication for both your GitHub and Vercel accounts.
