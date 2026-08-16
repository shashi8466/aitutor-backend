import React from 'react';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import UniversalLeaderboard from '../common/UniversalLeaderboard';

const { FiArrowLeft } = FiIcons;

const Leaderboard = () => {
    return (
        <div className="min-h-screen bg-[#0B0D14] text-white p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <Link
                        to="/student"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all bg-[#141824] px-4 py-2 rounded-xl border border-slate-800 shadow-sm"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Dashboard
                    </Link>
                </div>

                <UniversalLeaderboard role="student" />
            </div>
        </div>
    );
};

export default Leaderboard;