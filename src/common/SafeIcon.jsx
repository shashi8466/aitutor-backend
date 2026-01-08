import React from 'react';
import * as FiIcons from 'react-icons/fi';
import { FiAlertTriangle } from 'react-icons/fi';

const SafeIcon = ({ icon, name, className, ...props }) => {
  let IconComponent = FiAlertTriangle;

  try {
    // If icon is passed directly as a component
    if (icon) {
      IconComponent = icon;
    } 
    // If name is passed (string)
    else if (name) {
      const iconName = name.startsWith('Fi') ? name : `Fi${name}`;
      if (FiIcons[iconName]) {
        IconComponent = FiIcons[iconName];
      }
    }
  } catch (e) {
    console.warn(`Failed to load icon: ${name}`, e);
  }

  return <IconComponent className={className} {...props} />;
};

export default SafeIcon;