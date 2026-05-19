const SERVER_BASE_URL = "http://localhost:5000"

function getUserId() {
    let resolve;
    let reject;

    const promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
    });

    const request = new Request("https://portals.veracross.com/oakwood/student/",
        {
            method: "h",
            credentials: "include",
            redirect: "manual",
            cache: "no-store",
        }
    );

    fetch(request).then(async function (response) {
        if (!response.ok) {
            reject("LOGIN_NEEDED");
            return -1;
        }

        const text = await response.text();

        const idMarker = "user_id: ";
        const idIndex = text.indexOf(idMarker);
        const endIndex = text.indexOf(",", idIndex);

        if (idIndex != -1 && endIndex != -1) {
            const user_id = parseInt(text.substring(idIndex + idMarker.length, endIndex));
            resolve(user_id);
        }
        else {
            reject("USER_ID_NOT_FOUND");
        }
    })

    return promise;
}

async function getCourseData() {
    const request = new Request("https://portals.veracross.com/oakwood/student/component/ClassListStudent/1308/load_data",
        {
            method: "GET",
            credentials: "include",
            cache: "no-store",
        }
    );

    const response = await fetch(request);

    const json = await response.json();
    
    const classes = [];

    for (const courseData of json['courses']) {
        //No reason to store nonacademic classes
        if (courseData['type'] != "academic") continue;
        const course = {
            enrollment_pk: courseData['enrollment_pk'],
            class_pk: courseData['class_pk'],
            class_name: courseData['class_name'],
            teacher_name: courseData['teacher_full_name'],
            numeric_grade: courseData['ptd_grade'],
            letter_grade: courseData['ptd_letter_grade']
        };

        classes.push(course);
    }

    return classes;

}

async function getAssignmentData(enrollment_pk, class_pk) {
    const request = new Request(`https://portals-embed.veracross.com/oakwood/student/enrollment/${enrollment_pk}/assignments`,
        {
            method: "GET",
            credentials: "include",
            cache: "no-store",
        }
    );

    const response = await fetch(request);

    const json = await response.json();
    
    const scores = [];
    for (const assignmentData of json['assignments']) {
        if (assignmentData['completion_status'] != 'Complete' && assignmentData['completion_status'] != 'Not Turned In') continue;
        const score = {
            id: assignmentData['score_id'],
            assignment_description: assignmentData['assignment_description'],
            assignment_notes: assignmentData['assignment_notes'],
            date: assignmentData['_date'],
            points_possible: assignmentData['points_possible'],
            maximum_score: assignmentData['maximum_score'],
            raw_score: assignmentData['raw_score'] == '' ? '0' : assignmentData['raw_score'],
            assignment_id: assignmentData['id'],
            course_id: class_pk
        };

        scores.push(score);
    }

    return scores;
}

function beginAuthentication() {
    //Rejects if not logged in to Veracross, or it fails to connect to backend
    //Resolves to email that needs to be verified.
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {resolve = res; reject = rej;})

    const request = new Request("https://portals.veracross.com/oakwood/student/",
        {
            method: "GET",
            credentials: "include",
            redirect: "manual",
            cache: "no-store",
        }
    );

    fetch(request).then(async function (response) {
        if (!response.ok) {
            reject("LOGIN_NEEDED")
        }
        else {
            const text = await response.text();

            const request = new Request(SERVER_BASE_URL + "/authenticate/",
                {
                    method: "POST",

                    body: JSON.stringify({
                        content: text,
                    }),

                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            )

            fetch(request).then(async function (response) {
                if (response.ok) {
                    const json = await response.json();
                    resolve(json["email"]);
                    await chrome.storage.local.set({
                        lastAuthenticated: (Date.now() / 1000),
                        lastEmail: json["email"],
                    });
                }
                else {
                    console.error("Failed to begin authentication: " + response.status);
                }
            })
        }
    });


    return promise;
}

function completeAuthentication(code, email) {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {resolve = res; reject = rej;})

    const request = new Request(SERVER_BASE_URL + `/authenticate/verify/`, {
        method: "POST",
        body: JSON.stringify(
            {
                email: email,
                code: code,
            }
        ),
        headers: {
            "Content-Type": "application/json"
        }
    });

    fetch(request).then(
        async function (response) {
            const data = await response.json();
            if (data["result"] == "Expired") {
                reject("EXPIRED");
            }
            else if (data["result"] == "Verified") {
                resolve(data["authentication_key"]);
            }
        },
        async function (rejection) {
            reject("GENERAL_FAILURE");
        }
    )

    return promise;
}

async function checkAuthentication() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {resolve=res; reject=rej;});

    const data = await chrome.storage.local.get(["authenticationKey"]);
    
    if (data["authenticationKey"] == undefined) {
        resolve(false);
        return promise;
    }

    const request = new Request("https://portals.veracross.com/oakwood/student/student/overview", {
        method: "HEAD",
        credentials: "include",
        redirect: "manual",
        cache: "no-store",
    });

    try {
        fetch(request).then((response)=>{
            if (response.ok) resolve(true);
            else resolve(false);
        })
    }
    catch {};


    return promise;
    
    request = new Request(SERVER_BASE_URL + "/authenticate/check/", {
        method: "POST",
        body: JSON.stringify(
            {
                authentication_key: data["authenticationKey"],
            }
        ),
        headers: {
            "Content-Type": "application/json",
        }
    });

    const response = await fetch(request);

    if (!response.ok) {
        return false;
    }

    data = await response.json();

    if (data["result"] == "Success") {
        return true;
    }

    return false;
}

async function uploadCourseData(course_data) {
    if (!await checkAuthentication()) return;

    const data = await chrome.storage.local.get(["authenticationKey"]);
    const request = new Request(SERVER_BASE_URL + "/upload/course_data/", {
        method: "POST",
        body: JSON.stringify({
            authentication_key: data["authenticationKey"],
            courses: course_data,
        }),

        headers: {
            "Content-Type": "application/json"
        }

    });

    fetch(request);
}

async function uploadAssignmentData(courses) {
    if (!await checkAuthentication()) return;

    const data = await chrome.storage.local.get(["authenticationKey"])

    const scores = [];
    for (let course of courses) {
        scores.push(... await getAssignmentData(course["enrollment_pk"], course["class_pk"]));
    }

    const request = new Request(SERVER_BASE_URL + "/upload/assignment_data/", {
        method: "POST",
        body: JSON.stringify({
            authentication_key: data["authenticationKey"],
            scores: scores,
        }),

        headers: {
            "Content-Type": "application/json"
        }

    });

    fetch(request);
}

async function sync() {
    const auth_status = await checkAuthentication();
    if (!auth_status) return;

    const course_data = await getCourseData();
    uploadCourseData(course_data);
    uploadAssignmentData(course_data);


    chrome.alarms.create("syncAlarm", {
        delayInMinutes: currentSyncPeriod(),
    });
}

function currentSyncPeriod() {
    const time = new Date();

    //Update every 30 minutes on weekends
    if (time.getDay() == 0 || time.getDay() == 6) return 30;

    if (time.getHours() < 8) return 30;
    if (time.getHours() > 15) return 30;

    return 5;
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type == "user_id") {
        const response = {};
        getUserId().then(
            function(user_id) {
                response["result"] = "Success";
                response["user_id"] = user_id;
                sendResponse(response);
            },
            function (reason) {
                response["result"] = "Failure";
                response["reason"] = reason;
                sendResponse(response);
            }
        )
    }
    if (message.type == "check_authentication") {
        checkAuthentication().then( (response) => {
            sendResponse({result: response})
    });
    }
    if (message.type == "begin_authentication") {
        beginAuthentication().then(
            (email) => {
                sendResponse(
                    {
                        result: "Success",
                        email: email,
                    }
                )
            },
            (error_code) => {
                sendResponse(
                    {
                        result: "Failure",
                        reason: error_code,
                    }
                )
            }
        );
    }
    if (message.type == "submit_code") {
        completeAuthentication(message.code, message.email).then(
            function (authentication_key) {
                chrome.storage.local.set({authenticationKey: authentication_key});
                sendResponse({result: "AUTHENTICATED"});
            },
            function (error) {
                sendResponse({result: error});
            }
        );
    }

    return true;
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name == "syncAlarm") {
        sync();
    }
})

//Sync immediately on load, and then it will create an alarm for itself
sync();