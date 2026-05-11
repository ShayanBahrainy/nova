window.addEventListener("DOMContentLoaded", function () {
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
})