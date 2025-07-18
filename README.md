# Your Judge for Web and Server
[![GitHub Last Commit](https://img.shields.io/github/last-commit/agapedimas/Judge-Web.svg?")](https://github.com/agapedimas/Judge-Web/commits/master)
[![Bugs](https://img.shields.io/github/issues/agapedimas/Judge-Web/bug.svg)](https://github.com/agapedimas/Judge-Web/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)

Judge is an open source project. It uses Node.js and MySQL.

## Production Website
Judge is live now on [judge.agapedimas.com](https://judge.agapedimas.com). It's also available in Windows application, refer to [agapedimas/Your-Judge-Windows](https://github.com/agapedimas/Your-Judge-Windows).

### Screenshots
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/cb7e984f-b543-43d9-87f4-25f3233fab33" />
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/fe767d7f-a92d-49e7-9960-9d7bc4b56697" />

## Key Features
- **Diverse Challenges:**
Problems covering various topics.

- **Intuitive & Clean Design:**
A user-friendly interface that's easy to navigate, allowing you to focus on what matters.

- **Multi-Language Support:**
Support for popular programming languages like Java, C++, C#, JavaScript, and Python.

- **Automated Judging:**
The system automatically checks and scores your submitted code against pre-defined test cases.

- **Submission History & Code Persistence:**
Track all your solutions in one place. Your code is automatically saved with every submission, so you can revisit and review your last attempt at any time.

##  Tech Stack
- **Frontend:** Agape Dimas Assets (Located in: https://assets.agapedimas.com/ui/v3)
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Compiler:** [Piston](https://github.com/engineer-man/piston)

## Installation
To run Judge locally, follow these steps:

**1. Clone the repository**
```
git clone https://github.com/agapedimas/Judge-Web.git
```

**2. Create SQL database and add some environment variables**
```
SESSION_KEY = ...
SQL_USERNAME = ...
SQL_PASSWORD = ...
SQL_DATABASE = ...
```

**3. Install dependencies**
```
npm install
```

**4. Run the server**
```
npm run
```

**4. Open `http://localhost:17194` in your browser**


## How to Contribute
We are very open to contributions from the community! If you would like to help, please:

1. Fork this repository.

2. Create a new branch (`git checkout -b feature/FeatureName`).

3. Make your changes and commit them (`git commit -m 'Add some feature'`).

4. Push to your branch (`git push origin feature/FeatureName`).

5. Open a new Pull Request.

## License
Judge is licensed under the MIT License. Judge also includes external libraries that are available under a variety of licenses.
