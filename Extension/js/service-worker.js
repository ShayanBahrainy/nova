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
            method: "GET",
            credentials: "include",
            redirect: "manual"
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
            credentials: "include"
        }
    );

    const response = await fetch(request);

    const json = await response.json();
    
    const classes = [];

    for (const courseData of json['courses']) {
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

async function getAssignmentData(enrollment_pk, course_pk) {
    const request = new Request(`https://portals-embed.veracross.com/oakwood/student/enrollment/${enrollment_pk}/assignments`,
        {
            method: "GET",
            credentials: "include"
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
            course_id: course_pk
        };

        assignments.push(assignment);
    }

    return assignments;
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
            redirect: "manual"
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
                    resolve(response.json["email"]);
                    chrome.storage.local.set({
                        lastAuthenticated: (Date.now() / 1000),
                        lastEmail: response.json["email"],
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
    return true;
})