import React from 'react';

const Skeleton = ({ className = '', variant = 'rect' }) => {
    const baseClass = "animate-pulse bg-gray-200 dark:bg-gray-700";
    const variantClass = variant === 'circle' ? 'rounded-full' : 'rounded-xl';

    return (
        <div className={`${baseClass} ${variantClass} ${className}`} />
    );
};

export default Skeleton;
