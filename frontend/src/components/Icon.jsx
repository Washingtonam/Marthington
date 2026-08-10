const Icon = ({ name, className = "" }) => {
  const baseClass = `text-icon ${className}`;

  // Inline SVGs for industry icons (monochrome)
  if (name === 'shopping-bag') {
    return (
      <span aria-hidden="true" className={baseClass}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2h12l1 4H5l1-4z" fill="currentColor" opacity="0.08" />
          <path d="M6 6h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 10a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (name === 'graduation-cap') {
    return (
      <span aria-hidden="true" className={baseClass}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l9 4-9 4-9-4 9-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 10v4a9 9 0 0 0 18 0v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (name === 'stethoscope') {
    return (
      <span aria-hidden="true" className={baseClass}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 7v5a3 3 0 0 1-6 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 12a5 5 0 0 1-10 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="20" r="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  if (name === 'arrow') {
    return (
      <span aria-hidden="true" className={baseClass}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  // Fallback small glyphs for other icons
  const glyphs = {
    add: '+',
    alert: '!',
    arrow: '→',
    book: '📘',
    boxes: '#',
    building: 'B',
    chart: '%',
    dollar: '$',
    loader: '…',
    logout: 'x',
    menu: '=',
    package: 'P',
    search: '/',
    settings: '*',
    stock: 'S',
    team: '@',
    cart: '$',
    receipt: 'R',
    wallet: 'W'
  };

  return (
    <span aria-hidden="true" className={baseClass}>
      {glyphs[name] || '•'}
    </span>
  );
};

export default Icon;
