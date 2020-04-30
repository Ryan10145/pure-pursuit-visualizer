const conv = require("./conversions")
const Vector = require("./vector");

// TODO Make it so that the last point is the closest point to the path if it is undefined
// TODO Implement a feature where if the point is in a threshold just way too far, the robot will just do a turn towards the lookahead

// returns the index of the closest point to the given vector
// uses the last found point to optimize the search
let getClosestPointIndex = function(points, pos, lastPointIndex = 0) {
    let index = -1;
    let closestDist = -1;

    for(let i = lastPointIndex; i < points.length; i++) {
        waypoint = points[i];
        let checkDist = waypoint.getDistanceToSq(pos);

        if(index == -1 || checkDist <= closestDist) {
            index = i;
            closestDist = checkDist;
        }
    }

    return index;
}

let LookAheadResult = class {
    constructor(t, i, lookAheadPoint) {
        this.t = t;
        this.i = i;
        this.lookAheadPoint = lookAheadPoint;
    }
}

let getLookAheadPoint = function(points, pos, lookAheadDist, lastT = 0, lastIndex = 0) {
    for(let i = lastIndex; i < points.length - 1; i++) {
        let a = points[i];
        let b = points[i + 1];

        let t = getLookAheadPointT(pos, a.getPosition(), b.getPosition(), lookAheadDist);

        // if the segment is further along or the fractional index is greater, then this is the correct point
        if(t != -1 && (i > lastIndex || t > lastT)) {
            return generateLookAheadResult(a, b, t, i);
        }
    }

    // if no point is found, just return the last look ahead result
    return generateLookAheadResult(points[lastIndex], points[lastIndex + 1], lastT, lastIndex);
}

let generateLookAheadResult = function(a, b, t, i) {
    let d = b.getPosition().sub(a.getPosition());
    return new LookAheadResult(t, i, a.getPosition().add(d.mult(t)));
}

let getLookAheadPointT = function(pos, start, end, lookAheadDist) {
    let d = end.sub(start);
    let f = start.sub(pos);

    let a = d.dot(d);
    let b = 2 * f.dot(d);
    let c = f.dot(f) - lookAheadDist * lookAheadDist;

    let disc = b * b - 4 * a * c;

    if(disc < 0) {
        return -1;
    }
    
    disc = Math.sqrt(disc);
    let t1 = (-b - disc) / (2 * a);
    let t2 = (-b + disc) / (2 * a);

    if(t1 >= 0 && t1 <= 1) return t1;
    if(t2 >= 0 && t2 <= 1) return t2;

    return -1;
}

let getCurvatureToPoint = function(pos, angle, lookAhead, follower) {
    let a = -Math.tan(angle);
    let b = 1.0;
    let c = Math.tan(angle) * pos.getX() - pos.getY();

    let x = Math.abs(a * lookAhead.getX() + b * lookAhead.getY() + c) / Math.sqrt(a * a + b * b);
    let l = pos.getDistanceToSq(lookAhead);
    let curvature = 2 * x / l;

    let otherPoint = pos.add(new Vector(Math.cos(angle), Math.sin(angle)));
    let side = Math.sign((otherPoint.getY() - pos.getY()) * (lookAhead.getX() - pos.getX()) - 
        (otherPoint.getX() - pos.getX()) * (lookAhead.getY() - pos.getY()));

    follower.debug_a = a;
    follower.debug_b = b;
    follower.debug_c = c;

    return curvature * side;
}

let PurePursuitFollower = class {
    constructor(lookAheadDist, driveWidth, maxAcceleration) {
        this.lastT = 0.0;
        this.lastLookAheadIndex = 0;
        this.lastClosestIndex = 0;
        this.leftSpeed = 0;
        this.rightSpeed = 0;
        this.lastTime = -1;

        // robot line
        this.debug_a = 0;
        this.debug_b = 0;
        this.debug_c = 0;

        // look ahead point
        this.debug_la_x = -1257;
        this.debug_la_y = -1257;

        this.lookAheadDist = lookAheadDist;
        this.driveWidth = driveWidth;
        this.maxAcceleration = maxAcceleration;
    }
}

let followPath = function(robot, follower, points, currentTime) {
    if(points.length == 0) return;

    let lookAheadResult = getLookAheadPoint(points, robot.getPosition(), follower.lookAheadDist, 
        follower.lastT, follower.lastLookAheadIndex);
    follower.lastT = lookAheadResult.t;
    follower.lastLookAheadIndex = lookAheadResult.i;
    let lookAheadPoint = lookAheadResult.lookAheadPoint;

    follower.debug_la_x = lookAheadPoint.getX();
    follower.debug_la_y = lookAheadPoint.getY();

    let curvature = getCurvatureToPoint(robot.getPosition(), robot.getAngle(), lookAheadPoint, follower);
    follower.lastClosestIndex = getClosestPointIndex(points, robot.getPosition(), follower.lastClosestIndex);
    let targetVelocity = points[follower.lastClosestIndex].getTargetVelocity();

    let tempLeft = targetVelocity * (2.0 + curvature * follower.driveWidth) / 2.0;
    let tempRight = targetVelocity * (2.0 - curvature * follower.driveWidth) / 2.0;

    if(follower.lastCall == -1) follower.lastCall = currentTime;
    let maxChange = (currentTime - follower.lastCall) / 1000.0 * follower.maxAcceleration;
    follower.leftSpeed += constrain(tempLeft - follower.leftSpeed, maxChange, -maxChange);
    follower.rightSpeed += constrain(tempRight - follower.rightSpeed, maxChange, -maxChange);

    robot.setLeft(follower.leftSpeed);
    robot.setRight(follower.rightSpeed);

    follower.lastCall = currentTime;
}

let constrain = function(value, max, min) {
    if(value < min) return min;
    if(value > max) return max;
    return value;
}

module.exports = {
    followPath,
    PurePursuitFollower
};
