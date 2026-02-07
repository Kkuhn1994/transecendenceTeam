export const privacyPage = `
<div class="page-container">
  <div class="nav">
    <button id="privacyBack"><i class="fas fa-arrow-left"></i> Back</button>
  </div>


  <div id="privacy-section">
    <h1><i class="fas fa-shield-alt"></i> Privacy Policy</h1>
    <a href="#terms-section" class="jump-link" onclick="document.getElementById('terms-section').scrollIntoView({behavior:'instant'});return false;">
      <i class="fas fa-arrow-down"></i> Go to Terms of Service
    </a>

<p>
This website is a non-commercial university project.
Personal data is processed only to the extent necessary
to operate the website.
</p>

<h3><i class="fas fa-building"></i> 1. Data Controller</h3>
<p>
Rasmus Wegat<br>
42Heilbronn<br>
rwegat@student.42heilbronn.de
</p>

<h3><i class="fas fa-database"></i> 2. Processed Data</h3>
<p>
The following personal data may be processed:
</p>
<ul>
  <li><i class="fas fa-key"></i> Authentication data (JSON Web Token)</li>
  <li><i class="fas fa-cookie"></i> Session data stored in cookies</li>
</ul>

<h3><i class="fas fa-cookie-bite"></i> 3. Cookies</h3>
<p>
This website uses technically necessary cookies to manage
user sessions and authentication. These cookies are required
for the operation of the website and do not require consent
according to Art. 6(1)(f) GDPR.
</p>

<h3><i class="fas fa-bullseye"></i> 4. Purpose of Processing</h3>
<p>
Data is processed solely for user authentication and to
provide the functionality of the website.
</p>

<h3><i class="fas fa-share-alt"></i> 5. Data Sharing</h3>
<p>
Personal data is not shared with third parties.
</p>

<h3><i class="fas fa-clock"></i> 6. Storage Duration</h3>
<p>
Authentication and session data is stored only for the duration
of the session or until the user logs out. User-generated data,
such as match histories, is stored indefinitely unless the user
requests its deletion.
</p>

<h3><i class="fas fa-user-shield"></i> 7. Rights of the Data Subject</h3>
<p>
You have the right to access, rectification, deletion, and
restriction of processing of your personal data in accordance
with Articles 15–18 GDPR.
</p>
  </div>

  <hr style="margin: 2em 0;">

  <div id="terms-section">
    <h1><i class="fas fa-file-contract"></i> Terms of Service</h1>

<p>
This website is a non-commercial university project created
for educational purposes only.
</p>

<h3><i class="fas fa-gavel"></i> 1. Scope</h3>
<p>
These Terms apply to the use of this website.
</p>

<h3><i class="fas fa-laptop-code"></i> 2. Use of the Website</h3>
<p>
Users agree to use the website only for its intended purpose
and not to misuse or interfere with its operation.
</p>

<h3><i class="fas fa-signal"></i> 3. Availability</h3>
<p>
The website is provided without any guarantee of availability
or correctness.
</p>

<h3><i class="fas fa-exclamation-triangle"></i> 4. Liability</h3>
<p>
No liability is assumed for damages resulting from the use
of this website, except where required by law.
</p>
    <a href="#privacy-section" class="jump-link" onclick="document.getElementById('privacy-section').scrollIntoView({behavior:'instant'});return false;">
      <i class="fas fa-arrow-up"></i> Go back to Privacy Policy
    </a>
  </div>
</div>
`;
