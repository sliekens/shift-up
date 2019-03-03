# SHiFT-up

Redeeming SHiFT codes in-game is annoying, especially on consoles where you have to use the on-screen keyboard instead of a physical keyboard.

This command-line tool lets you redeem codes from the convenience of your computer, without having to launch a game.

# Prerequisites

- Node 8+
- Yarn
- A Gearbox SHiFT account (https://shift.gearboxsoftware.com/)

# Instructions

1. install dependencies
   - `yarn install`
2. (first time only) enter your Gearbox SHiFT e-mail and password
   - `yarn start login <email> <password>`
   - your credentials are transmitted over a secure connection to Gearbox **only**
   - an authentication cookie will be stored inside `secrets/<email>.json`
     - this file contains your login session, do not share this file with anybody!
   - I will NEVER try to steal your credentials
3. Redeem codes

   - Redeem one code: `yarn start redeem <email> <code>`
   - Redeem a list of codes: `yarn start redeem <email> <nameOfCodeFile.txt>` (include the `.txt`)

     - Premade shiftcode files:
       - Golden key codes: `keyCodes.txt`
       - Maya codes: `mayaCodes.txt`
       - Gaige codes: `gaigeCodes.txt`

   - To create your own list of codes create a `.txt` file in the `/shiftcodes` folder. Enter one code on each line.

If all went well, you should see the words "Your code was successfully redeemed".

![Example](assets/output.png)

Check the website to confirm that it worked.  
https://shift.gearboxsoftware.com/rewards

# Known issues

Message:

> To continue to redeem SHiFT codes, please launch a SHiFT-enabled title first!

The webserver only allows for 3 shiftcodes to be entered at a time before requiring you to relaunch borderlands.

Message:

> Internal Server Error

Something went wrong and it's not your fault. But let's keep it honest, you probably entered a bad code.

Message:

> StatusCodeError: 412 - "{}"

You probably entered a bad code.

Message:

> StatusCodeError: 429/504 - "{}"

The server is overloaded with requests.

# Planned features

- interactive mode: prompt for credentials and codes
- silent mode: don't log anything to stdout
- error handling (failed logins)

# Disclaimer

I don't work for Gearbox Software.

© 2018 Gearbox Software, LLC. SHiFT is trademark of Gearbox Software, LLC.
