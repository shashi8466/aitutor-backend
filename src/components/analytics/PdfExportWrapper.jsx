import React, { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import PdfReportTemplate from './PdfReportTemplate';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

/**
 * Wrapper component to handle "Download PDF" button and PDF generation.
 */
const PdfExportWrapper = ({ type, data, groupName, studentName, filename, buttonText = "Download PDF", className = "", children }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const pdfRef = useRef(null);

    const handleDownload = async () => {
        if (!pdfRef.current) return;
        setIsGenerating(true);

        // Temporarily unhide for capture
        pdfRef.current.classList.remove('hidden');
        pdfRef.current.style.display = 'block';

        const opt = {
            margin: 0.5,
            filename: `${filename || type.toLowerCase() + '_report'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(pdfRef.current).save();
        } catch (err) {
            console.error('PDF generation failed', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            // Re-hide
            pdfRef.current.style.display = '';
            pdfRef.current.classList.add('hidden');
            setIsGenerating(false);
        }
    };

    return (
        <>
            <button
                onClick={handleDownload}
                disabled={isGenerating}
                className={`transition-all disabled:opacity-50 ${className}`}
            >
                {children ? children : (
                    <>
                        {isGenerating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                            <SafeIcon icon={FiIcons.FiDownload} />
                        )}
                        {isGenerating ? 'Generating...' : buttonText}
                    </>
                )}
            </button>

            {/* Hidden template mounted in DOM */}
            <div className="fixed top-0 left-0 w-[800px] -z-50 pointer-events-none opacity-0">
                <PdfReportTemplate 
                    ref={pdfRef} 
                    type={type} 
                    data={data} 
                    groupName={groupName} 
                    studentName={studentName} 
                />
            </div>
        </>
    );
};

export default PdfExportWrapper;
