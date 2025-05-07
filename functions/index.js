const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const userDb = db.collection("users");

function hasKoreanCharacters(text) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

function checkEmailFormat(email) {
    return email && email.includes("@");
}

function checkTimeElapsed(timestamp) {
    const now = Date.now();
    return now - timestamp.toMillis() >= 60000;
}

exports.registerMember = onRequest((req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const { name, email } = req.body;

    if (!name || !email) {
        return res
            .status(400)
            .send({ error: "이름과 이메일을 모두 입력해주세요" });
    }

    if (hasKoreanCharacters(name)) {
        return res
            .status(400)
            .send({ error: "이름에 한글을 포함할 수 없습니다" });
    }

    if (!checkEmailFormat(email)) {
        return res
            .status(400)
            .send({ error: "올바른 이메일 형식이 아닙니다 (@가 필요합니다)" });
    }

    userDb
        .add({
            name,
            email,
            createdAt: new Date(),
        })
        .then((docRef) => {
            res.status(201).send({
                id: docRef.id,
                message: "회원 등록이 완료되었습니다",
            });
        })
        .catch((error) => {
            console.error("등록 오류:", error);
            res.status(500).send({ error: error.message });
        });
});

exports.findMemberByName = onRequest((req, res) => {
    if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
    }

    const memberName = req.query.name;
    if (!memberName) {
        return res.status(400).send({ error: "조회할 회원 이름이 필요합니다" });
    }

    userDb
        .where("name", "==", memberName)
        .limit(1)
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                return res
                    .status(404)
                    .send({ message: "해당 이름의 회원을 찾을 수 없습니다" });
            }

            const member = snapshot.docs[0];
            res.status(200).send({ id: member.id, ...member.data() });
        })
        .catch((error) => {
            console.error("조회 오류:", error);
            res.status(500).send({ error: error.message });
        });
});

exports.modifyMemberEmail = onRequest((req, res) => {
    if (req.method !== "PUT") {
        return res.status(405).send("Method Not Allowed");
    }

    const memberName = req.query.name;
    const updates = req.body;

    if (!memberName || !updates) {
        return res
            .status(400)
            .send({ error: "회원 이름과 수정할 정보가 필요합니다" });
    }

    if (updates.email && !checkEmailFormat(updates.email)) {
        return res
            .status(400)
            .send({ error: "올바른 이메일 형식이 아닙니다 (@가 필요합니다)" });
    }

    userDb
        .where("name", "==", memberName)
        .limit(1)
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                return res
                    .status(404)
                    .send({ message: "해당 이름의 회원을 찾을 수 없습니다" });
            }

            const memberDoc = snapshot.docs[0];
            return memberDoc.ref.update(updates);
        })
        .then(() => {
            res.status(200).send({
                message: "회원 정보가 성공적으로 수정되었습니다",
            });
        })
        .catch((error) => {
            console.error("수정 오류:", error);
            res.status(500).send({ error: error.message });
        });
});

exports.removeMember = onRequest((req, res) => {
    if (req.method !== "DELETE") {
        return res.status(405).send("Method Not Allowed");
    }

    const memberName = req.query.name;
    if (!memberName) {
        return res.status(400).send({ error: "삭제할 회원 이름이 필요합니다" });
    }

    userDb
        .where("name", "==", memberName)
        .limit(1)
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                return res
                    .status(404)
                    .send({ message: "해당 이름의 회원을 찾을 수 없습니다" });
            }

            const memberDoc = snapshot.docs[0];
            const memberData = memberDoc.data();

            if (!checkTimeElapsed(memberData.createdAt)) {
                return res.status(403).send({
                    message: "가입 후 1분이 지나야 삭제할 수 있습니다",
                });
            }

            return memberDoc.ref.delete().then(() => {
                res.status(200).send({
                    message: "회원이 성공적으로 삭제되었습니다",
                });
            });
        })
        .catch((error) => {
            console.error("삭제 오류:", error);
            res.status(500).send({ error: error.message });
        });
});
