const fs = require('fs');
const file = 'src/components/demo/DemoLeadForm.jsx';
let content = fs.readFileSync(file, 'utf8');

const stateReplacement = `  // OTP Verification States
  const [studentEmailOtpSent, setStudentEmailOtpSent] = useState(false);
  const [studentEmailOtpVerified, setStudentEmailOtpVerified] = useState(false);
  const [studentEmailOtp, setStudentEmailOtp] = useState('');
  const [studentEmailOtpLoading, setStudentEmailOtpLoading] = useState(false);
  const [studentEmailOtpError, setStudentEmailOtpError] = useState('');
  const [studentEmailDebugOtp, setStudentEmailDebugOtp] = useState('');

  const [parentEmailOtpSent, setParentEmailOtpSent] = useState(false);
  const [parentEmailOtpVerified, setParentEmailOtpVerified] = useState(false);
  const [parentEmailOtp, setParentEmailOtp] = useState('');
  const [parentEmailOtpLoading, setParentEmailOtpLoading] = useState(false);
  const [parentEmailOtpError, setParentEmailOtpError] = useState('');
  const [parentEmailDebugOtp, setParentEmailDebugOtp] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendStudentEmailOTP = async () => {
    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (!formData.email || !/^\\S+@\\S+\\.\\S+$/.test(formData.email)) {
      setError('Please enter a valid student email address.');
      return;
    }
    setStudentEmailOtpLoading(true);
    setStudentEmailOtpError('');
    setError('');
    setStudentEmailDebugOtp('');

    try {
      const response = await axios.post('/api/demo/send-email-otp', { email: formData.email });
      if (response.data.success) {
        setStudentEmailOtpSent(true);
        if (response.data.otpForTesting) {
          setStudentEmailDebugOtp(response.data.otpForTesting);
        }
      } else {
        setStudentEmailOtpError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      console.error('❌ [DEMO OTP] Send error:', err);
      setStudentEmailOtpError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setStudentEmailOtpLoading(false);
    }
  };

  const handleVerifyStudentEmailOTP = async () => {
    if (studentEmailOtp.length !== 6) {
      setStudentEmailOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setStudentEmailOtpLoading(true);
    setStudentEmailOtpError('');
    try {
      const response = await axios.post('/api/demo/verify-email-otp', { email: formData.email, otp: studentEmailOtp });
      if (response.data.success) {
        setStudentEmailOtpVerified(true);
        setStudentEmailOtpError('');
      } else {
        setStudentEmailOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setStudentEmailOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setStudentEmailOtpLoading(false);
    }
  };

  const handleSendParentEmailOTP = async () => {
    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (!formData.parentEmail || !/^\\S+@\\S+\\.\\S+$/.test(formData.parentEmail)) {
      setError('Please enter a valid parent email address.');
      return;
    }
    setParentEmailOtpLoading(true);
    setParentEmailOtpError('');
    setError('');
    setParentEmailDebugOtp('');

    try {
      const response = await axios.post('/api/demo/send-email-otp', { email: formData.parentEmail });
      if (response.data.success) {
        setParentEmailOtpSent(true);
        if (response.data.otpForTesting) {
          setParentEmailDebugOtp(response.data.otpForTesting);
        }
      } else {
        setParentEmailOtpError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      console.error('❌ [DEMO OTP] Send error:', err);
      setParentEmailOtpError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setParentEmailOtpLoading(false);
    }
  };

  const handleVerifyParentEmailOTP = async () => {
    if (parentEmailOtp.length !== 6) {
      setParentEmailOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setParentEmailOtpLoading(true);
    setParentEmailOtpError('');
    try {
      const response = await axios.post('/api/demo/verify-email-otp', { email: formData.parentEmail, otp: parentEmailOtp });
      if (response.data.success) {
        setParentEmailOtpVerified(true);
        setParentEmailOtpError('');
      } else {
        setParentEmailOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setParentEmailOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setParentEmailOtpLoading(false);
    }
  };

  const handleVerifyAndSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (!studentEmailOtpVerified) {
      setError('Please verify the student email address.');
      return;
    }
    if (!parentEmailOtpVerified) {
      setError('Please verify the parent email address.');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = \`\${countryCode}\${formData.phone.replace(/[^\\d]/g, '')}\`;
      const cleanedFormData = {
        ...formData,
        phone: fullPhone,
        countryCode
      };
      await onSubmit(cleanedFormData);
      setSubmitted(true);
    } catch (err) {
      console.error('❌ [DEMO] Submit error:', err);
      setError(err?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };`;

content = content.replace(
  /\\/\\/ OTP Verification States[\\s\\S]*?const handleVerifyAndSubmit = async \\(e\\) => {[\\s\\S]*?finally {[^}]*}[^}]*}/,
  stateReplacement.trim()
);

content = content.replace(
  'Please verify your details to start the SAT practice test.</p>',
  'Please verify your details to start the SAT practice test. Your test report and score report will be sent to your verified email addresses.</p>'
);

const uiStartStr = `                {!otpSent ? (`;
const indexStart = content.indexOf(uiStartStr);
if (indexStart !== -1) {
  const uiEndStr = `                )}`;
  const indexEnd = content.indexOf(uiEndStr, indexStart) + uiEndStr.length;
  
  const uiReplacement = `                <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Student Full Name</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <SafeIcon icon={FiUser} className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Grade</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                        <SafeIcon icon={FiBookOpen} className="w-4 h-4" />
                      </div>
                      <select
                        required
                        name="grade"
                        value={formData.grade}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium cursor-pointer hover:bg-gray-50"
                      >
                        <option value="" className="text-gray-500">Select Grade</option>
                        <option value="9" className="text-gray-900">Grade 9</option>
                        <option value="10" className="text-gray-900">Grade 10</option>
                        <option value="11" className="text-gray-900">Grade 11</option>
                        <option value="12" className="text-gray-900">Grade 12</option>
                        <option value="Other" className="text-gray-900">Other</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
                        <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Student Email Address</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <SafeIcon icon={FiMail} className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={studentEmailOtpVerified || studentEmailOtpSent}
                        placeholder="john@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50 disabled:opacity-60"
                      />
                    </div>

                    {/* STUDENT EMAIL OTP FLOW */}
                    {!studentEmailOtpVerified && (
                      <div className="mt-2 space-y-2">
                        {!studentEmailOtpSent ? (
                          <button
                            type="button"
                            disabled={studentEmailOtpLoading || !formData.email || !/^\\S+@\\S+\\.\\S+$/.test(formData.email) || !termsAccepted}
                            onClick={handleSendStudentEmailOTP}
                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-[10px] font-bold rounded-lg transition-all disabled:opacity-50 uppercase tracking-widest"
                          >
                            {studentEmailOtpLoading ? 'Sending...' : 'Verify Student Email'}
                          </button>
                        ) : (
                          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                              Code sent to {formData.email}
                            </p>
                            {studentEmailOtpError && (
                              <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide">{studentEmailOtpError}</p>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-Digit OTP"
                                value={studentEmailOtp}
                                onChange={(e) => setStudentEmailOtp(e.target.value.replace(/[^\\d]/g, ''))}
                                className="flex-1 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#E53935]"
                              />
                              <button
                                type="button"
                                disabled={studentEmailOtpLoading || studentEmailOtp.length !== 6}
                                onClick={handleVerifyStudentEmailOTP}
                                className="px-4 py-2 bg-[#E53935] hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all disabled:opacity-50"
                              >
                                {studentEmailOtpLoading ? 'Verifying...' : 'Verify'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={handleSendStudentEmailOTP}
                              className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold underline"
                            >
                              Resend Code
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {studentEmailOtpVerified && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-green-200/50 flex items-center gap-1.5">
                        <SafeIcon icon={FiCheckCircle} className="w-3 h-3 text-green-600 dark:text-green-400" />
                        Student email verified!
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Parent Name</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <SafeIcon icon={FiUser} className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="text"
                        name="parentName"
                        value={formData.parentName}
                        onChange={handleChange}
                        placeholder="Sarah Doe"
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Parent Email Address</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <SafeIcon icon={FiMail} className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="email"
                        name="parentEmail"
                        value={formData.parentEmail}
                        onChange={handleChange}
                        disabled={parentEmailOtpVerified || parentEmailOtpSent}
                        placeholder="sarah@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50 disabled:opacity-60"
                      />
                    </div>

                    {/* PARENT EMAIL OTP FLOW */}
                    {!parentEmailOtpVerified && (
                      <div className="mt-2 space-y-2">
                        {!parentEmailOtpSent ? (
                          <button
                            type="button"
                            disabled={parentEmailOtpLoading || !formData.parentEmail || !/^\\S+@\\S+\\.\\S+$/.test(formData.parentEmail) || !termsAccepted}
                            onClick={handleSendParentEmailOTP}
                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-[10px] font-bold rounded-lg transition-all disabled:opacity-50 uppercase tracking-widest"
                          >
                            {parentEmailOtpLoading ? 'Sending...' : 'Verify Parent Email'}
                          </button>
                        ) : (
                          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                              Code sent to {formData.parentEmail}
                            </p>
                            {parentEmailOtpError && (
                              <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide">{parentEmailOtpError}</p>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-Digit OTP"
                                value={parentEmailOtp}
                                onChange={(e) => setParentEmailOtp(e.target.value.replace(/[^\\d]/g, ''))}
                                className="flex-1 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#E53935]"
                              />
                              <button
                                type="button"
                                disabled={parentEmailOtpLoading || parentEmailOtp.length !== 6}
                                onClick={handleVerifyParentEmailOTP}
                                className="px-4 py-2 bg-[#E53935] hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all disabled:opacity-50"
                              >
                                {parentEmailOtpLoading ? 'Verifying...' : 'Verify'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={handleSendParentEmailOTP}
                              className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold underline"
                            >
                              Resend Code
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {parentEmailOtpVerified && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-green-200/50 flex items-center gap-1.5">
                        <SafeIcon icon={FiCheckCircle} className="w-3 h-3 text-green-600 dark:text-green-400" />
                        Parent email verified!
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Country</label>
                      <div className="relative">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-full pl-3 pr-8 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-bold hover:bg-gray-50 cursor-pointer"
                        >
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+91">🇮🇳 +91</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
                          <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Phone Number</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          <SafeIcon icon={FiPhone} className="w-4 h-4" />
                        </div>
                        <input
                          required
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="e.g., 713 452 0639"
                          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Checkbox */}
                  <div className="flex items-start gap-2 py-1 mt-2">
                    <input
                      id="termsAccepted"
                      name="termsAccepted"
                      type="checkbox"
                      required
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 text-[#E53935] border-gray-300 rounded focus:ring-[#E53935] cursor-pointer shrink-0"
                    />
                    <label htmlFor="termsAccepted" className="text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none leading-normal">
                      I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-[#E53935] underline hover:text-red-700 font-black inline">Privacy Policy &amp; Terms &amp; Conditions</button>
                    </label>
                  </div>

                  <button
                    disabled={loading || !termsAccepted || !studentEmailOtpVerified || !parentEmailOtpVerified || !formData.fullName || !formData.email || !formData.phone || !formData.parentName || !formData.parentEmail || !formData.grade}
                    type="submit"
                    className="w-full mt-4 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    {loading ? (
                      <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Start Exam</>
                    )}
                  </button>
                </form>`;
  content = content.substring(0, indexStart) + uiReplacement + content.substring(indexEnd);
}

fs.writeFileSync(file, content);
console.log('Successfully updated DemoLeadForm.jsx');
