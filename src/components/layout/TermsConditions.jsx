import React from 'react';
import { motion } from 'framer-motion';

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-40 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12"
        >
          <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Terms & Conditions</h1>
          
          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p>
                Welcome to AIPrep365. By creating an account, verifying OTP, or accessing our SAT/AP preparation platform, you agree to these Terms & Conditions.
              </p>
              <p className="mt-2">
                Users must read and accept these terms before signing up, verifying OTP, or starting any demo/full-length test.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">2. User Responsibilities</h2>
              <p className="mb-2">Users agree:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>To provide accurate information</li>
                <li>Not to misuse OTP systems</li>
                <li>Not to create fake accounts</li>
                <li>Not to share exam content illegally</li>
                <li>Not to attempt unauthorized access to the platform</li>
              </ul>
              <p className="font-medium text-gray-800">
                Violation of these terms may result in account suspension or removal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. OTP Verification Requirement</h2>
              <p className="mb-2">OTP verification is mandatory before:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Account creation</li>
                <li>Signup form submission</li>
                <li>Demo or SAT/AP exam access</li>
              </ul>
              <p className="font-bold text-red-600">
                Without successful OTP verification, users cannot continue using the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. Demo Test & Exam Rules</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Users may be required to complete registration before starting demo/full-length tests.</li>
                <li>OTP verification and acceptance of Terms & Conditions are mandatory before exam access.</li>
                <li>The platform reserves the right to restrict access if suspicious activity is detected.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Mandatory Acceptance</h2>
              <p className="mb-2">Before signup or exam access, users must check the checkbox below:</p>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium my-4 italic">
                "I agree to the Terms & Conditions and Privacy Policy"
              </div>
              <p className="mb-2">If unchecked:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Signup must remain blocked</li>
                <li>OTP verification submission must remain blocked</li>
                <li>Demo/SAT exam access must remain blocked</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Platform Rights</h2>
              <p className="mb-2">AIPrep365 reserves the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Update platform features</li>
                <li>Modify exam access rules</li>
                <li>Suspend accounts violating platform policies</li>
                <li>Update these terms at any time without prior notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Contact</h2>
              <p>
                For any terms, account, or platform-related concerns, users may contact the platform administrator or support team.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsConditions;
