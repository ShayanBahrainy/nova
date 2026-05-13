const message_templates = {
    ENTER_CODE: "Please enter the code sent to {email}"
}
window.addEventListener("DOMContentLoaded", async function () {
    chrome.runtime.sendMessage({type:"user_id"}, (response) => {
        if (response["result"] == "Success") {
            console.log("User id: " + response["user_id"]);
        }
        else if (response["result"] == "Failure") {
            if (response["reason"] == "LOGIN_NEEDED") {
                document.getElementById('login-button').classList.toggle('invisible');
            }
            else {
                ;
            }
        }
    });

    document.getElementById("login-button").addEventListener("click", function () {
        chrome.tabs.create({url: "https://portals.veracross.com/oakwood/login/"});
    })

    for (const element of document.getElementsByClassName("digit")) {
        element.addEventListener("input", function (ev) {
            let direction = 1;
            if (ev.target.value.length == 0) direction = -1;

            const num = parseInt(element.id.split('-')[1]);

            
            document.getElementById('digit-' + Math.max(0, Math.min(num + direction, 6))).focus();
        })
    }


    const data = await chrome.storage.local.get(["authenticationKey", "lastAuthenticated"]);
    const now = Date.now() / 1000;

    //Recover authentication if its less than 10 minutes ago
    //So the user can close and reopen the extension as needed.
    if (data["authenticationKey"] == undefined && !(data["lastAuthenticated"] != undefined && now - 10 * 60 < data["lastAuthenticated"])) {
        console.log("Creating new authentication session...")
        chrome.runtime.sendMessage({type:"begin_authentication"}, (response) => {
            if (response.result == "Success") {
                document.getElementById("email-code-label").value = message_templates['ENTER_CODE'].replace("{email}", response.email);
                document.getElementById("verify-code").classList.toggle("invisible");
            }
            else if (response.result == "Failure" && response.reason == "LOGIN_NEEDED") {
                console.error("Authentication attempted before Veracross login!");
            };
        })
    }
    else if (data["lastAuthenticated"] && now - 10 * 60 < data["lastAuthenticated"]) {
        console.log("Resuming authentication session...")
        const email = await chrome.storage.local.get(["lastEmail"]);

        document.getElementById("email-code-label").value = message_templates['ENTER_CODE'].replace("{email}", email);
        document.getElementById("verify-code").classList.toggle("invisible");
    }

})