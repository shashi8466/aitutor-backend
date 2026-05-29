import React from 'react';
import { motion } from 'framer-motion';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-40 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12"
        >
          <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p>
                Welcome to AIPrep365. By creating an account, verifying OTP, or accessing our SAT/AP preparation platform, you agree to this Privacy Policy.
              </p>
              <p className="mt-2">
                Users must read and accept this policy before signing up, verifying OTP, or starting any demo/full-length test.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              <p className="mb-2">We may collect the following information during signup or exam registration:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Mobile Number</li>
                <li>Parent/Guardian Name</li>
                <li>Parent/Guardian Email</li>
                <li>Account Type</li>
                <li>OTP Verification Status</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. OTP Verification & Messaging Policy</h2>
              <p className="mb-2">
                Mobile numbers are collected for OTP verification, authentication, account security, and important platform communication purposes.
              </p>
              <p className="mb-2">By providing your phone number, you consent to receive:</p>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <li>OTP verification codes</li>
                <li>Account-related notifications</li>
                <li>Important updates from AIPrep365</li>
              </ul>
              <p className="mb-2 text-sm font-medium text-gray-500">
                The platform supports OTP verification for both India (+91) and USA (+1) phone numbers.
              </p>
              <p className="mb-2 font-medium text-gray-800">Users must successfully verify OTP before:</p>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <li>Creating an account</li>
                <li>Submitting signup forms</li>
                <li>Starting demo SAT/AP exams</li>
              </ul>
              <p className="font-bold text-red-600">Without OTP verification, users cannot proceed further.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. How We Use User Data</h2>
              <p className="mb-2">User information is used only for:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Account creation and authentication</li>
                <li>OTP verification</li>
                <li>Exam access and progress tracking</li>
                <li>Parent communication (if required)</li>
                <li>Important platform notifications and updates</li>
                <li>Sending OTP and service-related messages</li>
              </ul>
              <p>We do not sell or share user personal information with unauthorized third parties.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Data Protection & Security</h2>
              <p className="mb-2">
                We take reasonable security measures to protect user information, OTP data, and personal details from unauthorized access, misuse, or disclosure.
              </p>
              <p className="mb-2">
                User data is stored securely and used only for platform-related operations.
              </p>
              <p>
                However, users are responsible for maintaining the confidentiality of their login credentials.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Parent Information</h2>
              <p className="mb-2">If parent/guardian details are collected:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>They will only be used for communication related to student performance, updates, account verification, or important notifications.</li>
                <li>Parent information will not be publicly displayed or shared externally.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Contact</h2>
              <p>
                For any privacy, OTP, or account-related concerns, users may contact the platform administrator or support team.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
