interface FlamesLogoProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: React.CSSProperties;
}

export function FlamesLogo({ size = 32, color = "#B8860B", opacity = 1, style }: FlamesLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 108"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      opacity={opacity}
      style={style}
    >
      {/* Outer-left flame — sweeps from bottom-center, curves up-left */}
      <path d="M50,104 C36,96 22,82 17,64 C12,47 16,30 27,18 C30,14 34,18 33,28
               C37,19 40,9 37,3 C50,14 52,42 42,62 C35,75 38,90 50,104Z"/>
      {/* Inner-left flame */}
      <path d="M40,92 C36,81 31,65 34,48 C36,38 39,32 41,34
               C41,26 40,14 38,6 C50,18 51,46 43,66 C39,76 40,85 40,92Z"/>
      {/* Center flame — tallest */}
      <path d="M50,86 C46,74 43,57 45,40 C46,30 48,22 50,18
               C52,22 54,30 55,40 C57,57 54,74 50,86Z
               M50,18 C49,11 50,2 50,2 C50,2 51,11 50,18Z"/>
      {/* Inner-right flame */}
      <path d="M60,92 C60,85 61,76 57,66 C49,46 50,18 62,6
               C60,14 59,26 59,34 C61,32 64,38 66,48
               C69,65 64,81 60,92Z"/>
      {/* Outer-right flame — mirror of outer-left */}
      <path d="M50,104 C62,90 65,75 58,62 C48,42 50,14 63,3
               C60,9 63,19 67,28 C66,18 70,14 73,18
               C84,30 88,47 83,64 C78,82 64,96 50,104Z"/>
    </svg>
  );
}
