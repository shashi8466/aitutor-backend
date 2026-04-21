import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { FiEye, FiLogOut, FiShield } = FiIcons;

const PreviewBanner = () => {
    const { previewUser, setPreviewUser } = useAuth();
    const navigate = useNavigate();

    if (!previewUser) return null;

    const handleExit = () => {
        setPreviewUser(null);
        navigate('/admin');
    };

    return (
        <div className="bg-[#E53935] text-white px-4 py-3 sticky top-0 z-[9999] shadow-2xl flex items-center justify-between animate-in slide-in-from-top duration-300 ring-1 ring-white/10">
            <div className="flex items-center gap-4">
                <div className="bg-white/25 p-2 rounded-xl backdrop-blur-md shadow-inner">
                    <SafeIcon icon={FiEye} className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Preview Active</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                    </div>
                    <p className="text-sm font-bold leading-tight">
                        Viewing as <span className="underline decoration-white/40 underline-offset-4">{previewUser.name}</span> <span className="opacity-75 font-medium ml-1">({previewUser.role})</span>
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-2 bg-black/30 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
                   <SafeIcon icon={FiShield} className="w-4 h-4 text-white/70" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Admin Controls Restricted</span>
                </div>
                <button 
                    onClick={handleExit}
                    className="flex items-center gap-2 border-2 border-white bg-white text-[#E53935] px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-transparent hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                >
                    <SafeIcon icon={FiLogOut} className="w-4 h-4" />
                    Back to Admin
                </button>
            </div>
        </div>
    );
};

export default PreviewBanner;
