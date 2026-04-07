import React from 'react';

const BrandName = ({ className = "" }) => {
  return (
    <span className={`font-black tracking-tighter inline-flex items-center ${className}`}>
      <span className="bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] bg-clip-text text-transparent">AI</span>
      <span className="text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Prep</span>
      <span className="bg-gradient-to-r from-[#F59E0B] to-[#F97316] bg-clip-text text-transparent">365</span>
    </span>
  );
};

export default BrandName;
