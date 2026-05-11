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
    console.log(json['assignments'].length)
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

/*
chrome.runtime.onInstalled.addListener(async function (details) {
    getUserId().then(function(user_id) {
        console.log(user_id);
    }, function (reason) {
        if (reason == "LOGIN_NEEDED") {
            window.open("https://portals.veracross.com/oakwood/login");
        }
    })

    const courses = await getCourseData();
    const random_course = courses[Math.floor(Math.random() * courses.length)];

    const assignments = await getAssignmentData(random_course.enrollment_pk);
    
    console.log(random_course);
    console.log(assignments);
})*/

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
    return true;
})