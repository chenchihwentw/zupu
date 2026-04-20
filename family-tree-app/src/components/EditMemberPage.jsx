import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EditMemberPanel from './EditMemberPanel';

const EditMemberPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [allMembers, setAllMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        fetchMemberData();
    }, [id]);

    const fetchMemberData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            
            // Fetch member detail
            const memberResponse = await axios.get(`/api/member/${id}`, { headers });
            setMember(memberResponse.data);

            // Fetch all members for parent/spouse selection
            const allMembersResponse = await axios.get('/api/family', { headers });
            setAllMembers(allMembersResponse.data);

            setShowEditModal(true);
        } catch (error) {
            console.error('Failed to fetch member data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (updatedMember) => {
        try {
            await axios.put(`/api/family/${id}`, updatedMember);
            alert('Member updated successfully!');
            navigate(`/member/${id}`);
        } catch (error) {
            console.error('Failed to update member:', error);
            alert('Failed to update member');
        }
    };

    const handleDelete = async (memberId) => {
        if (window.confirm('Are you sure you want to delete this member?')) {
            try {
                await axios.delete(`/api/family/${memberId}`);
                alert('Member deleted successfully!');
                navigate('/');
            } catch (error) {
                console.error('Failed to delete member:', error);
                alert('Failed to delete member');
            }
        }
    };

    const handleCancel = () => {
        navigate(`/member/${id}`);
    };

    if (loading) {
        return <div style={styles.loading}>Loading...</div>;
    }

    if (!member) {
        return <div style={styles.error}>Member not found</div>;
    }

    return (
        <div>
            {showEditModal && (
                <EditMemberPanel
                    member={member}
                    allMembers={allMembers}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

const styles = {
    loading: {
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#666'
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#ff4d4f'
    }
};

export default EditMemberPage;
