// src/components/icons.tsx
import * as React from "react";

/** Common helpers */
type BaseIconProps = React.SVGProps<SVGSVGElement> & {
  /** Override ALL stroke widths in the icon */
  strokeWidthAll?: number;
  /** Override ALL stroke colors in the icon (sets CSS `color`, used by stroke="currentColor") */
  strokeColorAll?: string;
  /** If true, add vectorEffect="non-scaling-stroke" to all paths */
  nonScalingStroke?: boolean;
};

function a11yProps(rest: React.SVGProps<SVGSVGElement>) {
  const hasLabel = typeof rest["aria-label"] === "string" && rest["aria-label"]!.length > 0;
  return {
    role: hasLabel ? "img" : undefined,
    "aria-hidden": hasLabel ? undefined : true,
    focusable: false,
  } as const;
}

/** tiny helper to apply vectorEffect on every <path> we control */
const ns = (on?: boolean) => (on ? { vectorEffect: "non-scaling-stroke" as const } : undefined);

/* ----------------------------------------
   ADD PLAYER (T-shirt +)
----------------------------------------- */
export const AddPlayerIcon = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; plusStroke?: number; shirtStroke?: number }
>(function AddPlayerIcon(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, plusStroke = 2, shirtStroke = 20, style, ...rest },
  ref
) {
  const plusW = strokeWidthAll ?? plusStroke;
  const shirtW = strokeWidthAll ?? shirtStroke;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      {/* plus */}
      <g transform="matrix(1,0,0,1,0.255313,8.54142)">
        <path
          d="M18,7.5L18,10.5M18,10.5L18,13.5M18,10.5L21,10.5M18,10.5L15,10.5"
          stroke="currentColor"
          strokeWidth={plusW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
      {/* shirt */}
      <g transform="matrix(0.0798082,0,0,0.0798082,0.485246,1.08577)">
        <path
          d="M136.665,256.666L93.334,256.666C80.501,256.666 70.001,246.165 70.001,233.333L70.001,116.665L44.917,116.665C42.141,116.673 39.453,115.691 37.335,113.895C35.218,112.098 33.811,109.606 33.367,106.865L26.601,66.382C25.675,60.894 26.742,55.255 29.609,50.484C32.476,45.714 36.953,42.124 42.234,40.365L93.334,23.332C93.334,35.709 98.25,47.578 107.002,56.33C115.754,65.082 127.624,69.999 140.001,69.999C152.377,69.999 164.247,65.082 172.999,56.33C181.75,47.578 186.667,35.709 186.667,23.332L237.767,40.365C243.047,42.124 247.525,45.714 250.392,50.484C253.258,55.255 254.326,60.894 253.4,66.382L246.635,106.865C246.19,109.606 244.783,112.098 242.665,113.895C240.548,115.691 237.86,116.673 235.085,116.665L222.846,116.665L222.846,138.913"
          stroke="currentColor"
          strokeWidth={shirtW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
    </svg>
  );
});
AddPlayerIcon.displayName = "AddPlayerIcon";

/* ----------------------------------------
   PLAYER ONLY T-SHIRT
----------------------------------------- */
export const PlayerOnlyTshirt = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; shirtStroke?: number }
>(function PlayerOnlyTshirt(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, shirtStroke = 18.8, style, ...rest },
  ref
) {
  const shirtW = strokeWidthAll ?? shirtStroke;
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      <g transform="matrix(0.0798082,0,0,0.0798082,0.826817,1.08577)">
        <path
          d="M237.767,40.365L186.667,23.332C186.667,35.709 181.75,47.578 172.999,56.33C164.247,65.082 152.377,69.999 140.001,69.999C127.624,69.999 115.754,65.082 107.002,56.33C98.25,47.578 93.334,35.709 93.334,23.332L42.234,40.365C36.953,42.124 32.476,45.714 29.609,50.484C26.742,55.255 25.675,60.894 26.601,66.382L33.367,106.865C33.811,109.606 35.218,112.098 37.335,113.895C39.453,115.691 42.141,116.673 44.917,116.665L70.001,116.665L70.001,233.333C70.001,246.165 80.501,256.666 93.334,256.666L186.667,256.666C192.855,256.666 198.791,254.207 203.166,249.832C207.543,245.455 210,239.521 210,233.333L210,116.665L235.085,116.665C237.86,116.673 240.548,115.691 242.666,113.895C244.783,112.098 246.19,109.606 246.635,106.865L253.4,66.382C254.326,60.894 253.258,55.255 250.392,50.484C247.525,45.714 243.047,42.124 237.767,40.365Z"
          stroke="currentColor"
          strokeWidth={shirtW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
    </svg>
  );
});
PlayerOnlyTshirt.displayName = "PlayerOnlyTshirt";

/* ----------------------------------------
   MY PLAYERS (outer torso + inner shield)
----------------------------------------- */
export const MyPlayersIconDefault = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; outerStroke?: number; innerStroke?: number }
>(function MyPlayersIconDefault(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, outerStroke = 21.8, innerStroke = 31.67, style, ...rest },
  ref
) {
  const outerW = strokeWidthAll ?? outerStroke;
  const innerW = strokeWidthAll ?? innerStroke;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      <g transform="matrix(0.0798082,0,0,0.0798082,0.485246,1.08577)">
        {/* outer silhouette */}
        <path
          d="M253.4,66.382C254.326,60.894 253.258,55.255 250.392,50.484C247.525,45.714 243.047,42.124 237.767,40.365L186.667,23.332C186.667,35.709 181.75,47.578 172.999,56.33C164.247,65.082 152.377,69.999 140.001,69.999C127.624,69.999 115.754,65.082 107.002,56.33C98.25,47.578 93.334,35.709 93.334,23.332L42.234,40.365C36.953,42.124 32.476,45.714 29.609,50.484C26.742,55.255 25.675,60.894 26.601,66.382L33.367,106.865C33.811,109.606 35.218,112.098 37.335,113.895C39.453,115.691 42.141,116.673 44.917,116.665L70.001,116.665L70.001,233.333C70.001,246.165 80.501,256.666 93.334,256.666L115.451,256.666"
          stroke="currentColor"
          strokeWidth={outerW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
        {/* inner shield */}
        <g transform="matrix(0.65567,0,0,0.65567,107.648,88.3778)">
          <path
            d="M237.767,40.365L186.667,23.332C186.667,35.709 181.75,47.578 172.999,56.33C164.247,65.082 152.377,69.999 140.001,69.999C127.624,69.999 115.754,65.082 107.002,56.33C98.25,47.578 93.334,35.709 93.334,23.332L42.234,40.365C36.953,42.124 32.476,45.714 29.609,50.484C26.742,55.255 25.675,60.894 26.601,66.382L33.367,106.865C33.811,109.606 35.218,112.098 37.335,113.895C39.453,115.691 42.141,116.673 44.917,116.665L70.001,116.665L70.001,233.333C70.001,246.165 80.501,256.666 93.334,256.666L186.667,256.666C192.855,256.666 198.791,254.207 203.166,249.832C207.543,245.455 210,239.521 210,233.333L210,116.665L235.085,116.665C237.86,116.673 240.548,115.691 242.666,113.895C244.783,112.098 246.19,109.606 246.635,106.865L253.4,66.382C254.326,60.894 253.258,55.255 250.392,50.484C247.525,45.714 243.047,42.124 237.767,40.365Z"
            stroke="currentColor"
            strokeWidth={innerW}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...ns(nonScalingStroke)}
          />
        </g>
      </g>
    </svg>
  );
});
MyPlayersIconDefault.displayName = "MyPlayersIconDefault";

/* ----------------------------------------
   ADD OBSERVATION (Eye +)
----------------------------------------- */
export const AddObservationIcon = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; plusStroke?: number }
>(function AddObservationIcon(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, plusStroke = 2, style, ...rest },
  ref
) {
  const plusW = strokeWidthAll ?? plusStroke;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      {/* plus */}
      <g transform="matrix(1,0,0,1,0.255313,8.54142)">
        <path
          d="M18,7.5L18,10.5M18,10.5L18,13.5M18,10.5L21,10.5M18,10.5L15,10.5"
          stroke="currentColor"
          strokeWidth={plusW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
      {/* eye */}
      <g>
        <g transform="matrix(1,0,0,0.929401,0,0.847194)">
          <path
            d="M11.295,19.477C6.966,19.19 3.356,16.28 2.037,12.322L2.036,12.322C1.967,12.115 1.967,11.89 2.036,11.683C3.423,7.51 7.36,4.5 12,4.5C16.638,4.5 20.573,7.507 21.963,11.678C22.033,11.885 22.033,12.109 21.963,12.317C21.786,12.851 21.567,13.365 21.302,13.852"
            stroke="currentColor"
            strokeWidth={plusW}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...ns(nonScalingStroke)}
          />
        </g>
        <g transform="matrix(1,0,0,0.929401,0,0.847194)">
          <path
            d="M15,12C15,13.646 13.646,15 12,15C10.354,15 9,13.646 9,12C9,10.354 10.354,9 12,9C13.646,9 15,10.354 15,12Z"
            stroke="currentColor"
            strokeWidth={plusW}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...ns(nonScalingStroke)}
          />
        </g>
      </g>
    </svg>
  );
});
AddObservationIcon.displayName = "AddObservationIcon";

/* ----------------------------------------
   KNOWN PLAYER (Shield + Check)
----------------------------------------- */
export const KnownPlayerIcon = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; shieldStroke?: number; markStroke?: number }
>(function KnownPlayerIcon(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, shieldStroke = 16, markStroke = 3.2, style, ...rest },
  ref
) {
  const shieldW = strokeWidthAll ?? shieldStroke;
  const markW = strokeWidthAll ?? markStroke;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      {/* shield */}
      <g transform="matrix(0.0798082,0,0,0.0798082,0.485246,1.08577)">
        <path
          d="M237.767,40.365L186.667,23.332C186.667,35.709 181.75,47.578 172.999,56.33C164.247,65.082 152.377,69.999 140.001,69.999C127.624,69.999 115.754,65.082 107.002,56.33C98.25,47.578 93.334,35.709 93.334,23.332L42.234,40.365C36.953,42.124 32.476,45.714 29.609,50.484C26.742,55.255 25.675,60.894 26.601,66.382L33.367,106.865C33.811,109.606 35.218,112.098 37.335,113.895C39.453,115.691 42.141,116.673 44.917,116.665L70.001,116.665L70.001,233.333C70.001,246.165 80.501,256.666 93.334,256.666L186.667,256.666C192.855,256.666 198.791,254.207 203.166,249.832C207.543,245.455 210,239.521 210,233.333L210,116.665L235.085,116.665C237.86,116.673 240.548,115.691 242.666,113.895C244.783,112.098 246.19,109.606 246.635,106.865L253.4,66.382C254.326,60.894 253.258,55.255 250.392,50.484C247.525,45.714 243.047,42.124 237.767,40.365Z"
          stroke="currentColor"
          strokeWidth={shieldW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
      {/* check */}
      <g transform="matrix(0.359443,0,0,0.359443,7.29193,9.93273)">
        <path
          d="M4.5,12.75L10.5,18.75L19.5,5.25"
          stroke="currentColor"
          strokeWidth={markW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
    </svg>
  );
});
KnownPlayerIcon.displayName = "KnownPlayerIcon";

/* ----------------------------------------
   UNKNOWN PLAYER (Shield + X)
----------------------------------------- */
export const UnknownPlayerIcon = React.forwardRef<
  SVGSVGElement,
  BaseIconProps & { className?: string; shieldStroke?: number; xStroke?: number }
>(function UnknownPlayerIcon(
  { className = "h-4 w-4", strokeWidthAll, strokeColorAll, nonScalingStroke, shieldStroke = 16, xStroke = 3.4, style, ...rest },
  ref
) {
  const shieldW = strokeWidthAll ?? shieldStroke;
  const xW = strokeWidthAll ?? xStroke;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: strokeColorAll, fillRule: "evenodd", clipRule: "evenodd", ...style }}
      {...a11yProps(rest)}
      {...rest}
    >
      {/* shield */}
      <g transform="matrix(0.0798082,0,0,0.0798082,0.485246,1.08577)">
        <path
          d="M237.767,40.365L186.667,23.332C186.667,35.709 181.75,47.578 172.999,56.33C164.247,65.082 152.377,69.999 140.001,69.999C127.624,69.999 115.754,65.082 107.002,56.33C98.25,47.578 93.334,35.709 93.334,23.332L42.234,40.365C36.953,42.124 32.476,45.714 29.609,50.484C26.742,55.255 25.675,60.894 26.601,66.382L33.367,106.865C33.811,109.606 35.218,112.098 37.335,113.895C39.453,115.691 42.141,116.673 44.917,116.665L70.001,116.665L70.001,233.333C70.001,246.165 80.501,256.666 93.334,256.666L186.667,256.666C192.855,256.666 198.791,254.207 203.166,249.832C207.543,245.455 210,239.521 210,233.333L210,116.665L235.085,116.665C237.86,116.673 240.548,115.691 242.666,113.895C244.783,112.098 246.19,109.606 246.635,106.865L253.4,66.382C254.326,60.894 253.258,55.255 250.392,50.484C247.525,45.714 243.047,42.124 237.767,40.365Z"
          stroke="currentColor"
          strokeWidth={shieldW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
      {/* X */}
      <g transform="matrix(0.356072,0,0,0.356072,7.38608,10.0719)">
        <path
          d="M6,18L18,6M6,6L18,18"
          stroke="currentColor"
          strokeWidth={xW}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...ns(nonScalingStroke)}
        />
      </g>
    </svg>
  );
});
UnknownPlayerIcon.displayName = "UnknownPlayerIcon";
