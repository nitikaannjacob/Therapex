import React, { ReactNode } from "react";
import { motion } from "motion/react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'primary', className = '', disabled, type = 'button' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-rex-red to-[#ff6b81] text-white shadow-[0_0_20px_rgba(255,71,87,0.3)]',
    secondary: 'bg-card border border-white/10 text-white hover:bg-white/5',
    outline: 'bg-transparent border border-rex-red text-rex-red hover:bg-rex-red/10',
    ghost: 'bg-transparent text-white/60 hover:text-white',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-6 py-3 rounded-xl font-display font-bold uppercase tracking-tight transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};
