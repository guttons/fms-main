import React from 'react';

export interface StockIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

export const StockIcon: React.FC<StockIconProps> = ({
  className = "w-5 h-5",
  size,
  strokeWidth = 1.75,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      {/* Base platform */}
      <rect x="1.5" y="19" width="21" height="2.5" rx="0.5" />
      
      {/* Left tank */}
      <path d="M2.5 19V9.5C5 8.2 8.5 8.2 11 9.5" />
      
      {/* Fuel droplet in left tank */}
      <path d="M6.75 11.5c-1.2 1.6-1.75 2.6-1.75 3.5a1.75 1.75 0 0 0 3.5 0c0-.9-.55-1.9-1.75-3.5z" />
      
      {/* Right tank (shared left wall, domed roof, right wall) */}
      <path d="M11 19V5.5C14 4.2 18.5 4.2 21.5 5.5V19" />
      
      {/* Ladder shaft rails */}
      <path d="M17.2 4.8V19" />
      <path d="M19.8 5.1V19" />
      
      {/* Ladder rungs */}
      <path d="M17.2 7.2h2.6" />
      <path d="M17.2 9.5h2.6" />
      <path d="M17.2 11.8h2.6" />
      <path d="M17.2 14.1h2.6" />
      <path d="M17.2 16.4h2.6" />
    </svg>
  );
};

export const TankFarmIcon = StockIcon;
export default StockIcon;
