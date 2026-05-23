type StudentPose = "listening" | "smiling" | "thinking" | "confused" | "distracted" | "challenging";

type StudentPortraitProps = {
  name: string;
  pose: StudentPose;
  paletteIndex: number;
  label: string;
};

const palettes = [
  { skin: "#f2ceb0", hair: "#263141", hoodie: "#36cfc2", vest: "#123c48", accent: "#e9fffb" },
  { skin: "#efc4a3", hair: "#55372c", hoodie: "#e8a63a", vest: "#493c1b", accent: "#fff4d8" },
  { skin: "#f5d6c4", hair: "#2f2450", hoodie: "#5b8cff", vest: "#1d365f", accent: "#e6efff" },
  { skin: "#efcabb", hair: "#5d3728", hoodie: "#f06f7d", vest: "#5c2430", accent: "#ffe3e7" },
  { skin: "#f6d7b8", hair: "#2a315d", hoodie: "#7d69f1", vest: "#292a54", accent: "#e8e2ff" },
  { skin: "#f0cda7", hair: "#344128", hoodie: "#63c174", vest: "#243f34", accent: "#e1f5e4" }
] as const;

function mouthPath(pose: StudentPose) {
  switch (pose) {
    case "smiling":
      return "M80 112 C91 123, 112 123, 124 112";
    case "confused":
      return "M84 118 C94 111, 108 111, 120 118";
    case "challenging":
      return "M82 115 C94 107, 109 107, 122 115";
    case "distracted":
      return "M86 116 L120 116";
    case "thinking":
      return "M87 116 C96 113, 106 113, 116 116";
    default:
      return "M84 114 C95 117, 109 117, 122 114";
  }
}

function poseSymbol(pose: StudentPose, accent: string) {
  switch (pose) {
    case "smiling":
      return (
        <g className="student-portrait__symbol">
          <path d="M164 56 C171 48, 181 51, 181 61 C181 74, 164 78, 164 88 C164 78, 147 74, 147 61 C147 51, 157 48, 164 56 Z" fill={accent} />
        </g>
      );
    case "thinking":
      return (
        <g className="student-portrait__symbol">
          <circle cx="168" cy="48" r="7" fill={accent} />
          <circle cx="182" cy="34" r="5" fill={accent} opacity="0.75" />
        </g>
      );
    case "confused":
      return (
        <text x="166" y="52" fill={accent} fontSize="28" fontWeight="800">
          ?
        </text>
      );
    case "distracted":
      return (
        <g className="student-portrait__symbol">
          <path d="M22 53 L43 42" stroke={accent} strokeWidth="7" strokeLinecap="round" />
          <path d="M34 70 L51 65" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case "challenging":
      return (
        <g className="student-portrait__symbol">
          <path d="M158 42 L184 30" stroke={accent} strokeWidth="7" strokeLinecap="round" />
          <path d="M165 61 L187 61" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity="0.75" />
        </g>
      );
    default:
      return (
        <g className="student-portrait__symbol">
          <path d="M160 42 C171 35, 181 39, 186 49" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
  }
}

export function StudentPortrait({ name, pose, paletteIndex, label }: StudentPortraitProps) {
  const palette = palettes[paletteIndex % palettes.length];
  const distracted = pose === "distracted";
  const raisedHand = pose === "smiling" || pose === "challenging";
  const thinking = pose === "thinking" || pose === "confused";

  return (
    <figure className={`student-portrait student-portrait--${pose}`} aria-label={`${name}，${label}`}>
      <svg viewBox="0 0 220 320" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`student-bg-${paletteIndex}`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#183948" />
            <stop offset="100%" stopColor="#0b1d28" />
          </linearGradient>
          <linearGradient id={`desk-${paletteIndex}`} x1="0%" x2="100%">
            <stop offset="0%" stopColor="#244a5b" />
            <stop offset="100%" stopColor="#132c3a" />
          </linearGradient>
        </defs>

        <rect x="10" y="10" width="200" height="300" rx="24" fill={`url(#student-bg-${paletteIndex})`} />
        <rect x="24" y="28" width="172" height="240" rx="20" fill="#102633" opacity="0.86" />
        <path d="M34 243 C59 218, 164 218, 188 243 L188 276 L34 276 Z" fill="#0a1720" opacity="0.72" />
        {poseSymbol(pose, palette.accent)}

        <g className="student-portrait__body">
          <path
            d={raisedHand ? "M53 189 C38 171, 33 148, 41 125" : thinking ? "M57 190 C44 184, 38 172, 40 158" : "M55 190 C43 202, 35 220, 32 242"}
            fill="none"
            stroke={palette.skin}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d={raisedHand ? "M167 190 C179 176, 184 158, 181 139" : distracted ? "M167 191 C181 197, 190 211, 193 232" : "M166 190 C178 202, 186 220, 190 242"}
            fill="none"
            stroke={palette.skin}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path d="M60 196 C72 166, 91 151, 110 151 C130 151, 149 166, 161 196 L174 263 L47 263 Z" fill={palette.vest} />
          <path d="M75 168 L110 215 L146 168 L160 264 L61 264 Z" fill={palette.hoodie} />
          <path d="M76 169 L110 216 L145 169" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" />
          <path d="M80 154 C91 166, 130 166, 141 154 L147 170 C133 184, 87 184, 73 170 Z" fill={palette.accent} opacity="0.28" />
        </g>

        <g className="student-portrait__head">
          <ellipse cx="110" cy="90" rx="48" ry="54" fill={palette.skin} />
          <path
            d="M65 83 C67 47, 88 33, 111 33 C139 33, 158 50, 159 83 C145 66, 124 62, 110 62 C94 62, 76 68, 65 83 Z"
            fill={palette.hair}
          />
          <path d="M69 79 C83 62, 101 58, 119 60 C137 62, 151 70, 158 84 C151 52, 134 40, 110 40 C87 40, 72 52, 69 79 Z" fill={palette.hair} opacity="0.92" />
          <circle cx={distracted ? 93 : 91} cy="96" r="4" fill="#10202a" />
          <circle cx={distracted ? 121 : 129} cy="96" r="4" fill="#10202a" />
          <rect x="82" y={pose === "confused" || pose === "challenging" ? 87 : 89} width="20" height="4" rx="2" fill="#213444" transform={`rotate(${pose === "confused" ? -14 : pose === "challenging" ? 12 : 0} 92 91)`} />
          <rect x="119" y={pose === "confused" || pose === "challenging" ? 87 : 89} width="20" height="4" rx="2" fill="#213444" transform={`rotate(${pose === "confused" ? 14 : pose === "challenging" ? -12 : 0} 129 91)`} />
          <path d={mouthPath(pose)} fill="none" stroke="#6a3a34" strokeWidth="4" strokeLinecap="round" />
          <path d="M110 83 C106 88, 104 92, 104 98" fill="none" stroke="#9b6753" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </g>

        <g className="student-portrait__desk">
          <path d="M25 252 H195 L181 300 H39 Z" fill={`url(#desk-${paletteIndex})`} />
          <path d="M42 260 H178" stroke="#4a7282" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
          <rect x="74" y="272" width="72" height="11" rx="5.5" fill="#0b1b25" />
          <rect x="85" y="275" width="50" height="5" rx="2.5" fill={palette.accent} opacity="0.8" />
        </g>
      </svg>
      <figcaption>
        <strong>{name}</strong>
        <span>{label}</span>
      </figcaption>
    </figure>
  );
}
