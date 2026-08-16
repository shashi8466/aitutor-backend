import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiChevronRight, FiHome, FiArrowLeft } = FiIcons;

const AnalyticsBreadcrumb = ({ path, onNavigate, onBackToGroups }) => {
    const handleRootBack = () => {
        if (onBackToGroups) {
            onBackToGroups();
        } else if (onNavigate) {
            onNavigate(1);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
                type="button"
                onClick={handleRootBack}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#111625] hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800 shadow-sm group cursor-pointer"
            >
                <SafeIcon icon={FiArrowLeft} className="w-4 h-4 text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Groups</span>
            </button>

            <nav className="flex items-center text-xs text-slate-400 font-medium bg-[#111625] py-2 px-4 rounded-xl border border-slate-800 shadow-sm">
                {path.map((item, index) => {
                    const isLast = index === path.length - 1;
                    return (
                        <div key={item.id} className="flex items-center">
                            <button
                                onClick={() => {
                                    if (index === 0 && onBackToGroups) {
                                        onBackToGroups();
                                    } else if (!isLast) {
                                        onNavigate(item.level);
                                    }
                                }}
                                disabled={isLast}
                                className={`flex items-center gap-1.5 transition-colors ${
                                    isLast 
                                        ? 'text-white font-bold cursor-default' 
                                        : 'hover:text-blue-400 text-slate-400 cursor-pointer'
                                }`}
                            >
                                {index === 0 ? <SafeIcon icon={FiHome} className="w-4 h-4 mb-0.5" /> : null}
                                <span className="truncate max-w-[150px]">{item.label}</span>
                            </button>
                            
                            {!isLast && (
                                <SafeIcon icon={FiChevronRight} className="mx-2 text-slate-600 w-4 h-4" />
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
};

export default AnalyticsBreadcrumb;
